"""Backend API tests for Nickcoin."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL") or "https://nickcoin-beta.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


def _rand_email():
    return f"TEST_{uuid.uuid4().hex[:10]}@nickcoin.app"


def _rand_username():
    return f"TEST_{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def pioneer_token(session):
    """Ensure pioneer user exists and return token."""
    r = session.post(f"{API}/auth/login", json={"email": "pioneer@nickcoin.app", "password": "Pioneer123!"})
    if r.status_code == 401:
        # create
        session.post(f"{API}/auth/register", json={
            "email": "pioneer@nickcoin.app", "password": "Pioneer123!", "username": "pioneer"
        })
        r = session.post(f"{API}/auth/login", json={"email": "pioneer@nickcoin.app", "password": "Pioneer123!"})
    assert r.status_code == 200, f"pioneer login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def new_user(session):
    """Create a fresh user for isolated testing."""
    email = _rand_email()
    username = _rand_username()
    password = "Str0ngPass!"
    r = session.post(f"{API}/auth/register", json={
        "email": email, "password": password, "username": username
    })
    assert r.status_code == 200, f"register failed: {r.text}"
    data = r.json()
    return {
        "email": email, "username": username, "password": password,
        "token": data["token"], "user": data["user"], "seed_phrase": data["seed_phrase"],
    }


# ---------- Health ----------
class TestHealth:
    def test_root(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("status") == "online"


# ---------- Auth ----------
class TestAuth:
    def test_register_returns_token_user_seed(self, session):
        email = _rand_email()
        r = session.post(f"{API}/auth/register", json={
            "email": email, "password": "Pass1234!", "username": _rand_username()
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert "token" in d and "user" in d and "seed_phrase" in d
        words = d["seed_phrase"].split()
        assert len(words) == 12
        assert d["user"]["email"] == email.lower()
        assert d["user"]["referral_code"]
        assert d["user"]["balance_nkg"] == 0.0

    def test_duplicate_email_returns_400(self, session, new_user):
        r = session.post(f"{API}/auth/register", json={
            "email": new_user["email"], "password": "Pass1234!", "username": _rand_username()
        })
        assert r.status_code == 400

    def test_login_success(self, session, new_user):
        r = session.post(f"{API}/auth/login", json={
            "email": new_user["email"], "password": new_user["password"]
        })
        assert r.status_code == 200
        assert "token" in r.json() and "user" in r.json()

    def test_login_bad_password(self, session, new_user):
        r = session.post(f"{API}/auth/login", json={
            "email": new_user["email"], "password": "WrongPass123!"
        })
        assert r.status_code == 401

    def test_me_with_bearer(self, session, new_user):
        r = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {new_user['token']}"})
        assert r.status_code == 200
        assert r.json()["user"]["email"] == new_user["email"].lower()

    def test_me_without_auth(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_recover_with_correct_seed(self, session):
        # fresh user just for recovery
        email = _rand_email()
        username = _rand_username()
        reg = session.post(f"{API}/auth/register", json={
            "email": email, "password": "OldPass123!", "username": username
        })
        assert reg.status_code == 200
        seed = reg.json()["seed_phrase"]
        r = session.post(f"{API}/auth/recover", json={
            "email": email, "seed_phrase": seed, "new_password": "NewPass456!"
        })
        assert r.status_code == 200, r.text
        assert "token" in r.json()
        # old password should now fail
        bad = session.post(f"{API}/auth/login", json={"email": email, "password": "OldPass123!"})
        assert bad.status_code == 401
        # new password works
        ok = session.post(f"{API}/auth/login", json={"email": email, "password": "NewPass456!"})
        assert ok.status_code == 200

    def test_recover_wrong_seed(self, session, new_user):
        fake_seed = "abandon " * 11 + "about"
        r = session.post(f"{API}/auth/recover", json={
            "email": new_user["email"], "seed_phrase": fake_seed, "new_password": "Whatever123!"
        })
        assert r.status_code == 400

    def test_language_update(self, session, new_user):
        r = session.post(
            f"{API}/auth/language",
            json={"language": "en"},
            headers={"Authorization": f"Bearer {new_user['token']}"},
        )
        assert r.status_code == 200
        # verify persistence
        me = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {new_user['token']}"})
        assert me.json()["user"]["language"] == "en"


# ---------- Mining ----------
class TestMining:
    @pytest.fixture(scope="class")
    def user(self, session):
        email = _rand_email()
        r = session.post(f"{API}/auth/register", json={
            "email": email, "password": "Pass1234!", "username": _rand_username()
        })
        assert r.status_code == 200
        return {"token": r.json()["token"]}

    def _hdr(self, u):
        return {"Authorization": f"Bearer {u['token']}"}

    def test_start_session(self, session, user):
        r = session.post(f"{API}/mining/start", headers=self._hdr(user))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["remaining_seconds"] > 86300  # ~86400
        assert d["remaining_seconds"] <= 86400

    def test_status_active(self, session, user):
        r = session.get(f"{API}/mining/status", headers=self._hdr(user))
        assert r.status_code == 200
        d = r.json()
        assert d["active"] is True
        assert d["remaining_seconds"] > 86000

    def test_double_start_rejected(self, session, user):
        r = session.post(f"{API}/mining/start", headers=self._hdr(user))
        assert r.status_code == 400

    def test_claim_before_complete(self, session, user):
        r = session.post(f"{API}/mining/claim", headers=self._hdr(user))
        assert r.status_code == 400

    def test_daily_bonus_first_time(self, session, user):
        r = session.post(f"{API}/mining/daily-bonus", headers=self._hdr(user))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["currency"] == "BETA"
        assert d["claimed"] == 100.0

    def test_daily_bonus_second_fail(self, session, user):
        r = session.post(f"{API}/mining/daily-bonus", headers=self._hdr(user))
        assert r.status_code == 400

    def test_history(self, session, user):
        r = session.get(f"{API}/mining/history", headers=self._hdr(user))
        assert r.status_code == 200
        items = r.json()["items"]
        assert isinstance(items, list)
        assert any(t.get("type") == "daily_bonus" for t in items)


# ---------- Referrals ----------
class TestReferrals:
    def test_referrals_empty(self, session, new_user):
        r = session.get(f"{API}/referrals", headers={"Authorization": f"Bearer {new_user['token']}"})
        assert r.status_code == 200
        d = r.json()
        assert d["code"] == new_user["user"]["referral_code"]
        assert d["count"] == 0
        assert d["items"] == []

    def test_referral_credits_referrer(self, session, new_user):
        # register a new user with referral_code = new_user's code
        code = new_user["user"]["referral_code"]
        ref_email = _rand_email()
        r = session.post(f"{API}/auth/register", json={
            "email": ref_email, "password": "Pass1234!", "username": _rand_username(),
            "referral_code": code,
        })
        assert r.status_code == 200
        # check referrer balance += 5
        me = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {new_user['token']}"})
        bal = me.json()["user"]["balance_nkg"]
        assert bal >= 5.0, f"expected >=5 NKG, got {bal}"
        # referrals list shows 1
        r2 = session.get(f"{API}/referrals", headers={"Authorization": f"Bearer {new_user['token']}"})
        assert r2.json()["count"] >= 1


# ---------- Chat ----------
class TestChat:
    def test_post_and_get_message(self, session, new_user):
        content = f"TEST_hello_{uuid.uuid4().hex[:6]}"
        r = session.post(
            f"{API}/chat/messages",
            json={"content": content},
            headers={"Authorization": f"Bearer {new_user['token']}"},
        )
        assert r.status_code == 200
        assert r.json()["content"] == content
        # public GET
        r2 = session.get(f"{API}/chat/messages")
        assert r2.status_code == 200
        contents = [m["content"] for m in r2.json()["items"]]
        assert content in contents


# ---------- Market ----------
class TestMarket:
    def test_market_prices(self, session):
        r = session.get(f"{API}/market/prices")
        assert r.status_code == 200
        d = r.json()
        assert "items" in d
        assert len(d["items"]) >= 13 or d.get("fallback") is True or d.get("stale") is True
        # Validate at least 13 of our expected coins are present (live or fallback)
        ids = {i["id"] for i in d["items"]}
        expected = {"bitcoin", "ethereum", "ripple", "litecoin", "uniswap", "dash",
                    "polkadot", "monero", "eos", "iota", "cardano", "zcash", "nem"}
        missing = expected - ids
        # Allow CoinGecko to drop a coin, but ensure core ones present
        assert len(missing) <= 3, f"missing coins: {missing}"
        for item in d["items"]:
            assert "symbol" in item and "price_usd" in item and "change_24h" in item
