from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import secrets
import hashlib
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import bcrypt
import jwt
import httpx
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from mnemonic import Mnemonic

# ---------- Config ----------
JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]
ACCESS_TOKEN_EXPIRE_DAYS = 30  # mobile UX

MINING_DURATION_HOURS = 24
MINING_BASE_RATE_PER_HOUR = 0.25  # Nick King per hour
DAILY_BONUS_AMOUNT = 1.0  # NKG
REFERRAL_BONUS = 5.0  # NKG per referral that registers

# Transfer fees (Nickcoin internal network)
TRANSFER_FEE_PCT = 0.001  # 0.1%
MIN_TRANSFER_NKG = 0.01
MIN_TRANSFER_BETA = 1.0

# ---------- DB ----------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "test_database")]

# ---------- App ----------
app = FastAPI(title="Nickcoin API", version="1.0.0")
api_router = APIRouter(prefix="/api")
bearer_scheme = HTTPBearer(auto_error=False)

# ---------- Logging ----------
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("nickcoin")

# ---------- Helpers ----------
mnemo = Mnemonic("english")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def hash_seed(seed: str) -> str:
    # store SHA-256 of normalized seed phrase (12 words, lowercase, single-spaced)
    norm = " ".join(seed.strip().lower().split())
    return hashlib.sha256(norm.encode("utf-8")).hexdigest()


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def gen_referral_code() -> str:
    return secrets.token_hex(4).upper()  # 8 chars


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def serialize_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "username": u.get("username"),
        "referral_code": u.get("referral_code"),
        "referred_by": u.get("referred_by"),
        "balance_nkg": float(u.get("balance_nkg", 0.0)),
        "balance_beta": float(u.get("balance_beta", 0.0)),
        "language": u.get("language", "pt"),
        "created_at": u.get("created_at").isoformat() if u.get("created_at") else None,
    }


async def get_current_user(
    request: Request,
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    token: Optional[str] = None
    if creds and creds.scheme.lower() == "bearer":
        token = creds.credentials
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Token inválido")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Utilizador não encontrado")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessão expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


# ---------- Models ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    username: str = Field(min_length=2, max_length=32)
    language: Optional[str] = "pt"
    referral_code: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class RecoverIn(BaseModel):
    email: EmailStr
    seed_phrase: str
    new_password: str = Field(min_length=6, max_length=128)


class ChatMessageIn(BaseModel):
    content: str = Field(min_length=1, max_length=500)


class LanguageIn(BaseModel):
    language: str


class TransferIn(BaseModel):
    recipient: str = Field(min_length=2, max_length=64)  # username or referral_code
    amount: float = Field(gt=0)
    currency: str = Field(pattern="^(NKG|BETA)$")
    note: Optional[str] = Field(default=None, max_length=140)


# ---------- Routes: Auth ----------
@api_router.post("/auth/register")
async def register(payload: RegisterIn):
    email = payload.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email já registado")

    if await db.users.find_one({"username": payload.username}):
        raise HTTPException(status_code=400, detail="Nome de utilizador já em uso")

    seed_phrase = mnemo.generate(strength=128)  # 12 words
    user_id = str(uuid.uuid4())
    referral_code = gen_referral_code()

    referred_by = None
    if payload.referral_code:
        ref_user = await db.users.find_one({"referral_code": payload.referral_code.upper()})
        if ref_user:
            referred_by = ref_user["id"]
            # Bonus to referrer
            await db.users.update_one(
                {"id": referred_by},
                {"$inc": {"balance_nkg": REFERRAL_BONUS}},
            )
            await db.referrals.insert_one({
                "id": str(uuid.uuid4()),
                "referrer_id": referred_by,
                "referee_email": email,
                "bonus": REFERRAL_BONUS,
                "created_at": now_utc(),
            })

    user_doc = {
        "id": user_id,
        "email": email,
        "username": payload.username,
        "password_hash": hash_password(payload.password),
        "seed_hash": hash_seed(seed_phrase),
        "referral_code": referral_code,
        "referred_by": referred_by,
        "balance_nkg": 0.0,
        "balance_beta": 0.0,
        "language": payload.language or "pt",
        "created_at": now_utc(),
    }
    await db.users.insert_one(user_doc)

    token = create_access_token(user_id, email)
    return {
        "token": token,
        "user": serialize_user(user_doc),
        "seed_phrase": seed_phrase,  # ONLY returned at registration
    }


@api_router.post("/auth/login")
async def login(payload: LoginIn):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    token = create_access_token(user["id"], user["email"])
    return {"token": token, "user": serialize_user(user)}


@api_router.post("/auth/recover")
async def recover(payload: RecoverIn):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="Conta não encontrada")
    if hash_seed(payload.seed_phrase) != user.get("seed_hash"):
        raise HTTPException(status_code=400, detail="Frase de recuperação inválida")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"password_hash": hash_password(payload.new_password)}},
    )
    token = create_access_token(user["id"], user["email"])
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {"token": token, "user": serialize_user(fresh)}


@api_router.get("/auth/me")
async def me(current=Depends(get_current_user)):
    return {"user": serialize_user(current)}


@api_router.post("/auth/language")
async def set_language(payload: LanguageIn, current=Depends(get_current_user)):
    await db.users.update_one(
        {"id": current["id"]},
        {"$set": {"language": payload.language}},
    )
    return {"ok": True, "language": payload.language}


# ---------- Routes: Mining ----------
async def get_active_session(user_id: str):
    return await db.mining_sessions.find_one(
        {"user_id": user_id, "claimed": False},
        sort=[("started_at", -1)],
    )


def session_progress(session: dict):
    started: datetime = session["started_at"]
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    end: datetime = started + timedelta(hours=MINING_DURATION_HOURS)
    now = now_utc()
    total_seconds = MINING_DURATION_HOURS * 3600
    elapsed = max(0, min(total_seconds, int((now - started).total_seconds())))
    remaining = max(0, int((end - now).total_seconds()))
    rate = float(session.get("rate", MINING_BASE_RATE_PER_HOUR))
    earned = round((elapsed / 3600.0) * rate, 6)
    return {
        "started_at": started.isoformat(),
        "ends_at": end.isoformat(),
        "remaining_seconds": remaining,
        "elapsed_seconds": elapsed,
        "rate_per_hour": rate,
        "earned": earned,
        "complete": remaining == 0,
    }


@api_router.get("/mining/status")
async def mining_status(current=Depends(get_current_user)):
    session = await get_active_session(current["id"])
    if not session:
        return {"active": False}
    p = session_progress(session)
    return {"active": True, "session_id": session["id"], **p}


@api_router.post("/mining/start")
async def mining_start(current=Depends(get_current_user)):
    existing = await get_active_session(current["id"])
    if existing:
        p = session_progress(existing)
        if not p["complete"]:
            raise HTTPException(status_code=400, detail="Sessão de mineração já activa")

    # base rate + 0.05 per active referral
    ref_count = await db.users.count_documents({"referred_by": current["id"]})
    rate = MINING_BASE_RATE_PER_HOUR + (0.05 * ref_count)

    session = {
        "id": str(uuid.uuid4()),
        "user_id": current["id"],
        "started_at": now_utc(),
        "rate": rate,
        "claimed": False,
    }
    await db.mining_sessions.insert_one(session)
    return {"session_id": session["id"], **session_progress(session)}


@api_router.post("/mining/claim")
async def mining_claim(current=Depends(get_current_user)):
    session = await get_active_session(current["id"])
    if not session:
        raise HTTPException(status_code=400, detail="Sem sessão activa")
    p = session_progress(session)
    if not p["complete"]:
        raise HTTPException(status_code=400, detail="A sessão ainda não terminou")
    earned = float(p["earned"])
    await db.mining_sessions.update_one(
        {"id": session["id"]},
        {"$set": {"claimed": True, "claimed_at": now_utc(), "earned": earned}},
    )
    await db.users.update_one(
        {"id": current["id"]},
        {"$inc": {"balance_nkg": earned}},
    )
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current["id"],
        "type": "mining",
        "amount": earned,
        "currency": "NKG",
        "created_at": now_utc(),
    })
    return {"claimed": earned, "currency": "NKG"}


@api_router.post("/mining/daily-bonus")
async def daily_bonus(current=Depends(get_current_user)):
    today = now_utc().date().isoformat()
    last = current.get("last_daily_bonus")
    if last == today:
        raise HTTPException(status_code=400, detail="Bónus diário já reclamado")

    # Streak logic: +1 if claimed yesterday, else reset to 1
    yesterday = (now_utc().date() - timedelta(days=1)).isoformat()
    prev_streak = int(current.get("daily_streak", 0))
    streak = prev_streak + 1 if last == yesterday else 1
    # Bonus scales with streak (cap 7-day multiplier)
    multiplier = min(streak, 7)
    beta_reward = DAILY_BONUS_AMOUNT * 100 * multiplier
    nkg_bonus = 0.0
    if streak in (7, 30, 90, 365):
        nkg_bonus = {7: 1.0, 30: 5.0, 90: 20.0, 365: 100.0}[streak]

    await db.users.update_one(
        {"id": current["id"]},
        {
            "$set": {"last_daily_bonus": today, "daily_streak": streak},
            "$inc": {"balance_beta": beta_reward, "balance_nkg": nkg_bonus},
        },
    )
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current["id"],
        "type": "daily_bonus",
        "amount": beta_reward,
        "currency": "BETA",
        "streak": streak,
        "created_at": now_utc(),
    })
    if nkg_bonus > 0:
        await db.transactions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": current["id"],
            "type": "streak_reward",
            "amount": nkg_bonus,
            "currency": "NKG",
            "streak": streak,
            "created_at": now_utc(),
        })
    return {
        "claimed": beta_reward,
        "currency": "BETA",
        "streak": streak,
        "multiplier": multiplier,
        "nkg_bonus": nkg_bonus,
    }


@api_router.get("/mining/history")
async def mining_history(current=Depends(get_current_user)):
    cursor = db.transactions.find({"user_id": current["id"]}, {"_id": 0}).sort("created_at", -1).limit(50)
    items = []
    async for t in cursor:
        if isinstance(t.get("created_at"), datetime):
            t["created_at"] = t["created_at"].isoformat()
        items.append(t)
    return {"items": items}


# ---------- Routes: Referrals ----------
@api_router.get("/referrals")
async def referrals(current=Depends(get_current_user)):
    cursor = db.users.find({"referred_by": current["id"]}, {"_id": 0, "username": 1, "email": 1, "created_at": 1}).limit(100)
    items = []
    async for u in cursor:
        if isinstance(u.get("created_at"), datetime):
            u["created_at"] = u["created_at"].isoformat()
        items.append(u)
    return {
        "code": current.get("referral_code"),
        "count": len(items),
        "bonus_per_invite": REFERRAL_BONUS,
        "items": items,
    }


# ---------- Routes: Users / Transfer ----------
@api_router.get("/users/lookup")
async def users_lookup(q: str, current=Depends(get_current_user)):
    q = (q or "").strip()
    if not q:
        raise HTTPException(status_code=400, detail="Identificador inválido")
    user = await db.users.find_one(
        {"$or": [{"username": q}, {"referral_code": q.upper()}]},
        {"_id": 0, "id": 1, "username": 1, "referral_code": 1},
    )
    if not user:
        raise HTTPException(status_code=404, detail="Destinatário não encontrado")
    if user["id"] == current["id"]:
        raise HTTPException(status_code=400, detail="Não podes transferir para ti próprio")
    return user


def _gen_tx_hash() -> str:
    # Realistic looking 0x... 64-hex tx hash
    return "0x" + secrets.token_hex(32)


def _gen_block_height() -> int:
    # Deterministic-ish block height starting from Nickcoin genesis
    epoch = datetime(2026, 1, 1, tzinfo=timezone.utc)
    seconds = int((now_utc() - epoch).total_seconds())
    return 1_482_000 + (seconds // 5)  # ~5s blocks


@api_router.post("/transfer/send")
async def transfer_send(payload: TransferIn, current=Depends(get_current_user)):
    recipient_query = payload.recipient.strip()
    recipient = await db.users.find_one(
        {"$or": [{"username": recipient_query}, {"referral_code": recipient_query.upper()}]}
    )
    if not recipient:
        raise HTTPException(status_code=404, detail="Destinatário não encontrado")
    if recipient["id"] == current["id"]:
        raise HTTPException(status_code=400, detail="Não podes transferir para ti próprio")

    amount = round(float(payload.amount), 6)
    currency = payload.currency
    if currency == "NKG" and amount < MIN_TRANSFER_NKG:
        raise HTTPException(status_code=400, detail=f"Mínimo {MIN_TRANSFER_NKG} NKG")
    if currency == "BETA" and amount < MIN_TRANSFER_BETA:
        raise HTTPException(status_code=400, detail=f"Mínimo {MIN_TRANSFER_BETA} BETA")

    fee = round(amount * TRANSFER_FEE_PCT, 6)
    total_debit = round(amount + fee, 6)

    bal_field = "balance_nkg" if currency == "NKG" else "balance_beta"
    sender_balance = float(current.get(bal_field, 0.0))
    if sender_balance < total_debit:
        raise HTTPException(status_code=400, detail="Saldo insuficiente para a transferência (incluindo taxa)")

    # Atomic-ish double update: deduct from sender (with balance check), credit recipient
    upd = await db.users.update_one(
        {"id": current["id"], bal_field: {"$gte": total_debit}},
        {"$inc": {bal_field: -total_debit}},
    )
    if upd.modified_count != 1:
        raise HTTPException(status_code=400, detail="Saldo insuficiente")
    await db.users.update_one(
        {"id": recipient["id"]},
        {"$inc": {bal_field: amount}},
    )

    tx_hash = _gen_tx_hash()
    block = _gen_block_height()
    now = now_utc()

    common = {
        "tx_hash": tx_hash,
        "block": block,
        "currency": currency,
        "amount": amount,
        "fee": fee,
        "from_id": current["id"],
        "from_username": current.get("username"),
        "to_id": recipient["id"],
        "to_username": recipient.get("username"),
        "note": (payload.note or "").strip()[:140],
        "status": "confirmed",
        "network": "Nickcoin Mainnet (BETA)",
        "created_at": now,
    }

    # Sender ledger entry
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current["id"],
        "type": "transfer_out",
        "amount": -(amount + fee),
        **common,
    })
    # Recipient ledger entry
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": recipient["id"],
        "type": "transfer_in",
        "amount": amount,
        **common,
    })

    return {
        "ok": True,
        "tx_hash": tx_hash,
        "block": block,
        "status": "confirmed",
        "network": common["network"],
        "amount": amount,
        "fee": fee,
        "currency": currency,
        "to": {"username": recipient.get("username"), "referral_code": recipient.get("referral_code")},
        "timestamp": now.isoformat(),
    }


@api_router.get("/transfer/history")
async def transfer_history(current=Depends(get_current_user)):
    cursor = db.transactions.find(
        {"user_id": current["id"], "type": {"$in": ["transfer_in", "transfer_out"]}},
        {"_id": 0},
    ).sort("created_at", -1).limit(50)
    items = []
    async for t in cursor:
        if isinstance(t.get("created_at"), datetime):
            t["created_at"] = t["created_at"].isoformat()
        items.append(t)
    return {"items": items}


# ---------- Routes: Quests (Missions) ----------
def _iso_week(d: datetime) -> str:
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"


async def _build_quests(user: dict):
    """Compute current quest state for a user."""
    uid = user["id"]
    today = now_utc().date().isoformat()
    week = _iso_week(now_utc())
    year = now_utc().year

    claimed = user.get("quests_claimed", {}) or {}

    # Daily quests
    active_session = await db.mining_sessions.find_one({"user_id": uid, "claimed": False})
    started_mining_today = False
    if active_session and active_session.get("started_at"):
        st = active_session["started_at"]
        if st.tzinfo is None:
            st = st.replace(tzinfo=timezone.utc)
        started_mining_today = st.date().isoformat() == today

    chat_today = await db.chat_messages.count_documents({
        "user_id": uid,
        "created_at": {"$gte": datetime.fromisoformat(today + "T00:00:00+00:00")},
    })

    # Weekly quests
    week_start = now_utc() - timedelta(days=now_utc().weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    week_bonus_days = await db.transactions.count_documents({
        "user_id": uid,
        "type": "daily_bonus",
        "created_at": {"$gte": week_start},
    })
    week_referrals = await db.users.count_documents({
        "referred_by": uid,
        "created_at": {"$gte": week_start},
    })
    week_transfers = await db.transactions.count_documents({
        "user_id": uid,
        "type": "transfer_out",
        "created_at": {"$gte": week_start},
    })

    # Yearly quest — Nickcoin anniversary (Jan 1) — claimable once per year
    year_key = f"anniversary_{year}"

    quests = [
        {
            "id": f"daily_mine_{today}",
            "type": "daily",
            "title": "Iniciar mineração diária",
            "description": "Iniciar uma sessão de mineração hoje",
            "reward_nkg": 0.5,
            "reward_beta": 0,
            "progress": 1 if started_mining_today else 0,
            "goal": 1,
            "claimable": started_mining_today and f"daily_mine_{today}" not in claimed,
            "claimed": f"daily_mine_{today}" in claimed,
        },
        {
            "id": f"daily_chat_{today}",
            "type": "daily",
            "title": "Falar na comunidade",
            "description": "Enviar 1 mensagem no chat global",
            "reward_nkg": 0,
            "reward_beta": 50,
            "progress": min(chat_today, 1),
            "goal": 1,
            "claimable": chat_today >= 1 and f"daily_chat_{today}" not in claimed,
            "claimed": f"daily_chat_{today}" in claimed,
        },
        {
            "id": f"weekly_streak_{week}",
            "type": "weekly",
            "title": "Semana de dedicação",
            "description": "Reclamar bónus diário em 5 dias esta semana",
            "reward_nkg": 3.0,
            "reward_beta": 0,
            "progress": min(week_bonus_days, 5),
            "goal": 5,
            "claimable": week_bonus_days >= 5 and f"weekly_streak_{week}" not in claimed,
            "claimed": f"weekly_streak_{week}" in claimed,
        },
        {
            "id": f"weekly_invite_{week}",
            "type": "weekly",
            "title": "Recrutador Nickcoin",
            "description": "Convidar 1 amigo esta semana",
            "reward_nkg": 5.0,
            "reward_beta": 0,
            "progress": min(week_referrals, 1),
            "goal": 1,
            "claimable": week_referrals >= 1 and f"weekly_invite_{week}" not in claimed,
            "claimed": f"weekly_invite_{week}" in claimed,
        },
        {
            "id": f"weekly_transfer_{week}",
            "type": "weekly",
            "title": "Rede activa",
            "description": "Enviar 1 transferência esta semana",
            "reward_nkg": 1.0,
            "reward_beta": 0,
            "progress": min(week_transfers, 1),
            "goal": 1,
            "claimable": week_transfers >= 1 and f"weekly_transfer_{week}" not in claimed,
            "claimed": f"weekly_transfer_{week}" in claimed,
        },
        {
            "id": year_key,
            "type": "yearly",
            "title": f"Aniversário Nickcoin {year}",
            "description": "Prémio anual dos pioneiros — reclamar em Janeiro",
            "reward_nkg": 50.0,
            "reward_beta": 0,
            "progress": 1 if now_utc().month == 1 else 0,
            "goal": 1,
            "claimable": now_utc().month == 1 and year_key not in claimed,
            "claimed": year_key in claimed,
        },
    ]
    return quests


@api_router.get("/quests")
async def quests_list(current=Depends(get_current_user)):
    quests = await _build_quests(current)
    return {"items": quests, "server_time": now_utc().isoformat()}


class QuestClaimIn(BaseModel):
    quest_id: str


@api_router.post("/quests/claim")
async def quests_claim(payload: QuestClaimIn, current=Depends(get_current_user)):
    quests = await _build_quests(current)
    quest = next((q for q in quests if q["id"] == payload.quest_id), None)
    if not quest:
        raise HTTPException(status_code=404, detail="Missão não encontrada")
    if quest["claimed"]:
        raise HTTPException(status_code=400, detail="Missão já reclamada")
    if not quest["claimable"]:
        raise HTTPException(status_code=400, detail="Missão ainda não completada")

    reward_nkg = float(quest["reward_nkg"] or 0)
    reward_beta = float(quest["reward_beta"] or 0)
    await db.users.update_one(
        {"id": current["id"]},
        {
            "$set": {f"quests_claimed.{payload.quest_id}": now_utc().isoformat()},
            "$inc": {"balance_nkg": reward_nkg, "balance_beta": reward_beta},
        },
    )
    if reward_nkg > 0:
        await db.transactions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": current["id"],
            "type": "quest_reward",
            "amount": reward_nkg,
            "currency": "NKG",
            "quest_id": payload.quest_id,
            "created_at": now_utc(),
        })
    if reward_beta > 0:
        await db.transactions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": current["id"],
            "type": "quest_reward",
            "amount": reward_beta,
            "currency": "BETA",
            "quest_id": payload.quest_id,
            "created_at": now_utc(),
        })
    return {"ok": True, "reward_nkg": reward_nkg, "reward_beta": reward_beta, "quest_id": payload.quest_id}


# ---------- Routes: Chat ----------
@api_router.post("/chat/messages")
async def post_message(payload: ChatMessageIn, current=Depends(get_current_user)):
    msg = {
        "id": str(uuid.uuid4()),
        "user_id": current["id"],
        "username": current.get("username", "user"),
        "content": payload.content.strip(),
        "created_at": now_utc(),
    }
    await db.chat_messages.insert_one(msg)
    msg.pop("_id", None)
    if isinstance(msg.get("created_at"), datetime):
        msg["created_at"] = msg["created_at"].isoformat()
    return msg


@api_router.get("/chat/messages")
async def get_messages(limit: int = 50):
    cursor = db.chat_messages.find({}, {"_id": 0}).sort("created_at", -1).limit(min(limit, 200))
    items = []
    async for m in cursor:
        if isinstance(m.get("created_at"), datetime):
            m["created_at"] = m["created_at"].isoformat()
        items.append(m)
    items.reverse()
    return {"items": items}


# ---------- Routes: Market (CoinGecko proxy) ----------
COINS = {
    "bitcoin": "BTC",
    "ethereum": "ETH",
    "ripple": "XRP",
    "litecoin": "LTC",
    "uniswap": "UNI",
    "dash": "DASH",
    "polkadot": "DOT",
    "monero": "XMR",
    "eos": "EOS",
    "iota": "IOTA",
    "cardano": "ADA",
    "zcash": "ZEC",
    "nem": "NEM",
}

MARKET_CACHE = {"data": None, "ts": None}

# Indicative fallback prices (used only when CoinGecko is unreachable AND no cache exists)
FALLBACK_PRICES = {
    "bitcoin":   {"price": 67234.12, "change": 1.24,  "cap": 1_320_000_000_000},
    "ethereum":  {"price": 3512.84,  "change": 0.78,  "cap": 422_000_000_000},
    "ripple":    {"price": 0.5234,   "change": -0.42, "cap": 28_900_000_000},
    "litecoin":  {"price": 78.45,    "change": 0.55,  "cap": 5_800_000_000},
    "uniswap":   {"price": 9.87,     "change": -1.12, "cap": 5_900_000_000},
    "dash":      {"price": 32.10,    "change": -0.21, "cap": 380_000_000},
    "polkadot":  {"price": 6.78,     "change": 0.65,  "cap": 9_400_000_000},
    "monero":    {"price": 168.92,   "change": 1.05,  "cap": 3_100_000_000},
    "eos":       {"price": 0.79,     "change": -0.30, "cap": 1_200_000_000},
    "iota":      {"price": 0.21,     "change": 0.18,  "cap": 720_000_000},
    "cardano":   {"price": 0.452,    "change": 0.92,  "cap": 16_000_000_000},
    "zcash":     {"price": 28.13,    "change": -0.66, "cap": 458_000_000},
    "nem":       {"price": 0.0185,   "change": 0.05,  "cap": 165_000_000},
}


@api_router.get("/market/prices")
async def market_prices():
    # 5 min cache
    if MARKET_CACHE["data"] and MARKET_CACHE["ts"] and (now_utc() - MARKET_CACHE["ts"]).total_seconds() < 300:
        return MARKET_CACHE["data"]
    ids = ",".join(COINS.keys())
    url = (
        "https://api.coingecko.com/api/v3/coins/markets"
        f"?vs_currency=usd&ids={ids}&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h"
    )
    try:
        async with httpx.AsyncClient(timeout=10.0) as cx:
            r = await cx.get(url, headers={"accept": "application/json"})
            r.raise_for_status()
            data = r.json()
        items = []
        for d in data:
            items.append({
                "id": d.get("id"),
                "symbol": (d.get("symbol") or "").upper(),
                "name": d.get("name"),
                "image": d.get("image"),
                "price_usd": d.get("current_price"),
                "change_24h": d.get("price_change_percentage_24h"),
                "market_cap": d.get("market_cap"),
            })
        result = {"items": items, "updated_at": now_utc().isoformat()}
        MARKET_CACHE["data"] = result
        MARKET_CACHE["ts"] = now_utc()
        return result
    except Exception as e:
        logger.warning(f"Market fetch failed: {e}")
        # If we have any older cached response, keep serving it
        if MARKET_CACHE["data"]:
            return {**MARKET_CACHE["data"], "stale": True}
        # Otherwise serve realistic fallback
        items = []
        for k, sym in COINS.items():
            fp = FALLBACK_PRICES.get(k, {"price": None, "change": None, "cap": None})
            items.append({
                "id": k, "symbol": sym, "name": k.capitalize(), "image": None,
                "price_usd": fp["price"], "change_24h": fp["change"], "market_cap": fp["cap"],
            })
        return {"items": items, "updated_at": now_utc().isoformat(), "fallback": True}


# ---------- Health ----------
@api_router.get("/")
async def root():
    return {"app": "Nickcoin", "status": "online", "version": "1.0.0"}


# ---------- Startup ----------
@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("username", unique=True)
    await db.users.create_index("referral_code", unique=True)
    await db.mining_sessions.create_index([("user_id", 1), ("claimed", 1)])
    await db.chat_messages.create_index("created_at")
    await db.transactions.create_index([("user_id", 1), ("created_at", -1)])
    logger.info("Nickcoin API ready")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


# ---------- Mount ----------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
