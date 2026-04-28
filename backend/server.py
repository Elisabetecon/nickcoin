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

    await db.users.update_one(
        {"id": current["id"]},
        {
            "$set": {"last_daily_bonus": today},
            "$inc": {"balance_beta": DAILY_BONUS_AMOUNT * 100},  # 1 NKG = 100 Beta
        },
    )
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current["id"],
        "type": "daily_bonus",
        "amount": DAILY_BONUS_AMOUNT * 100,
        "currency": "BETA",
        "created_at": now_utc(),
    })
    return {"claimed": DAILY_BONUS_AMOUNT * 100, "currency": "BETA"}


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
