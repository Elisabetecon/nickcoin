# Nickcoin — PRD (Product Requirements Document)

## Vision
Hyper-realistic, hyper-formal, futurist mobile crypto-mining experience inspired by Pi Network. Built in Portugal. Brand: **Nickcoin**. Main currency: **Nick King (NKG)**. Sub-unit: **Beta** (1 NKG = 100 Beta).

## Stack
- Expo Router (React Native, .tsx) frontend
- FastAPI + MongoDB (Motor) backend
- JWT auth (Bearer in AsyncStorage), bcrypt password hashing
- BIP-39 12-word mnemonic recovery (`mnemonic` lib)
- CoinGecko for live market prices (5 min cache + indicative fallback)

## Core flows
1. **Splash** → animated LED neon mask logo, auto routes to (auth) or (tabs).
2. **Onboarding/Auth**
   - Welcome → Register (email, username, password, optional referral code)
   - On register: backend returns JWT + 12-word seed phrase (shown ONCE)
   - Login (email + password)
   - Recover (email + 12-word phrase + new password)
3. **Tabs (authenticated)**
   - **Mining**: balance card (NKG / Beta), centralised pulsating mining circle with the LED mask, 24h countdown, claim button, daily Beta bonus, transactions history.
   - **Wallet**: referral code & share, 6 wallet integration cards (Trust Wallet, MetaMask, Binance, Coinbase Wallet, Kraken, Ledger), 13 coin links (BTC, ETH, XRP, LTC, UNI, DASH, DOT, XMR, EOS, IOTA, ADA, ZEC, NEM).
   - **Market**: live CoinGecko prices + 24h change, 60s polling.
   - **Chat**: global real-time room (4s polling) with own/other bubbles.
   - **Profile**: balances, referral code, member since, language picker (PT, BR, EN, ES, FR, IT, DE, RU, TR, ZH), About modal (Founders Elisabete Gonçalves & Nick Oliveira, HQ Portugal, Direction E. Gonçalves, Development Futurist), Legal modal (VASP PT-2026-0142, MiCA, ISO/IEC 27001), logout.

## Mining economy
- Base rate: 0.25 NKG/hour (+0.05 per direct referral)
- Cycle: 24h → claim required to start next session
- Daily bonus: +100 Beta per UTC day
- Referral bonus: +5 NKG to referrer when invitee registers

## Backend endpoints (all under /api)
Auth: register, login, recover, me, language
Mining: status, start, claim, daily-bonus, history
Referrals: list & code
Chat: GET / POST messages
Market: prices (CoinGecko proxy)

## Languages (10)
pt, br, en, es, fr, it, de, ru, tr, zh

## Notable design tokens
- Background `#000`, surface `#0A0A0A`
- Primary neon `#00B4FF`, glow `#1FA2FF`
- Gold accent `#E5B86A` (Beta sub-unit)
- Logo: blue LED neon mask (provided by user, no text overlay)
