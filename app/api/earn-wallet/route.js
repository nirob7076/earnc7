// pages/api/earn-wallet.js
import { getDatabase, ref, get, set, update, push } from 'firebase/database';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Firebase Config (Load from Environment Variables)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

// Initialize Firebase (Server-side only)
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  console.error('Firebase init error:', error);
}

const db = app ? getDatabase(app) : null;

// Verify Telegram Data
function verifyTelegramData(initData, token) {
  if (!initData) return false;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  
  const dataCheckStr = Array.from(params.entries())
    .filter(([key]) => key !== 'hash')
    .sort()
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const crypto = require('crypto');
  const hmacKey = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const computedHash = crypto
    .createHmac('sha256', hmacKey)
    .update(dataCheckStr)
    .digest('hex');

  return computedHash === hash;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!db) {
    return res.status(500).json({ error: 'Database not initialized' });
  }

  try {
    const action = req.method === 'GET' ? req.query.action : req.body.action;

    // ===== GET CONFIG =====
    if (action === 'getConfig') {
      const configRef = ref(db, 'config');
      const snapshot = await get(configRef);
      const config = snapshot.val() || {};
      
      // Return only safe public fields (no secrets)
      return res.status(200).json({
        adReward: config.adReward || 5,
        referralBonus: config.referralBonus || 10,
        dailyBonus: config.dailyBonus || 2,
        minWithdraw: config.minWithdraw || 50,
        minWithdrawReferrals: config.minWithdrawReferrals || 0,
        currencySymbol: config.currencySymbol || 'TK',
        botUsername: config.botUsername || 'your_bot',
        supportLink: config.supportLink || '',
        spinRewards: config.spinRewards || [3, 4, 6],
        withdrawMethods: config.withdrawMethods || [
          { name: 'bKash', min: 50 },
          { name: 'Nagad', min: 50 },
          { name: 'Rocket', min: 50 }
        ],
      });
    }

    // ===== LOGIN / REGISTER =====
    if (action === 'login') {
      const { id, firstName, photoUrl, refId } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Missing user ID' });
      }

      const userRef = ref(db, `users/${id}`);
      const userSnapshot = await get(userRef);
      let user = userSnapshot.val();

      if (!user) {
        // New User
        const configRef = ref(db, 'config');
        const configSnapshot = await get(configRef);
        const config = configSnapshot.val() || {};
        const bonus = config.referralBonus || 0;

        user = {
          id,
          firstName: firstName || 'User',
          photoUrl: photoUrl || '',
          referrals: 0,
          balance: 0,
          totalEarned: 0,
          createdAt: Date.now(),
        };

        // Handle Referral
        if (refId && refId !== id) {
          const referrerRef = ref(db, `users/${refId}`);
          const referrerSnapshot = await get(referrerRef);
          const referrer = referrerSnapshot.val();

          if (referrer) {
            // Update Referrer
            await update(referrerRef, {
              balance: (referrer.balance || 0) + bonus,
              referrals: (referrer.referrals || 0) + 1,
            });
          }
        }

        // Save new user
        await set(userRef, user);
      } else {
        // Existing User - Update photo if changed
        if (photoUrl && user.photoUrl !== photoUrl) {
          await update(userRef, { photoUrl });
          user.photoUrl = photoUrl;
        }
      }

      // Return safe user data (no sensitive fields)
      return res.status(200).json({
        id: user.id,
        firstName: user.firstName,
        photoUrl: user.photoUrl,
        referrals: user.referrals || 0,
        balance: user.balance || 0,
        totalEarned: user.totalEarned || 0,
      });
    }

    // ===== UPDATE BALANCE =====
    if (action === 'updateBalance') {
      const { id, amount } = req.body;

      if (!id || typeof amount !== 'number') {
        return res.status(400).json({ error: 'Invalid parameters' });
      }

      const userRef = ref(db, `users/${id}`);
      const userSnapshot = await get(userRef);
      const user = userSnapshot.val();

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const newBalance = (user.balance || 0) + amount;
      const newEarned = (user.totalEarned || 0) + amount;

      await update(userRef, {
        balance: newBalance,
        totalEarned: newEarned,
      });

      // Log Transaction (Optional)
      const txRef = push(ref(db, `transactions/${id}`));
      await set(txRef, {
        type: 'ad_watch',
        amount,
        timestamp: Date.now(),
      });

      return res.status(200).json({ success: true, newBalance });
    }

    // ===== GET LEADERBOARD =====
    if (action === 'getLeaderboard') {
      const usersRef = ref(db, 'users');
      const snapshot = await get(usersRef);
      const usersData = snapshot.val() || {};

      let users = Object.values(usersData)
        .sort((a, b) => (b.referrals || 0) - (a.referrals || 0))
        .slice(0, 20)
        .map((u) => ({
          id: u.id,
          firstName: u.firstName,
          photoUrl: u.photoUrl,
          referrals: u.referrals || 0,
        }));

      return res.status(200).json(users);
    }

    // ===== GET HISTORY =====
    if (action === 'getHistory') {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'Missing user ID' });
      }

      const pendingRef = ref(db, 'withdrawals/pending');
      const completedRef = ref(db, 'withdrawals/completed');
      const rejectedRef = ref(db, 'withdrawals/rejected');

      const [pendingSnap, completedSnap, rejectedSnap] = await Promise.all([
        get(pendingRef),
        get(completedRef),
        get(rejectedRef),
      ]);

      let history = [];

      const processStatus = (snap, status) => {
        const data = snap.val();
        if (data) {
          Object.values(data).forEach((item) => {
            if (String(item.userId) === String(id)) {
              history.push({
                ...item,
                status,
              });
            }
          });
        }
      };

      processStatus(pendingSnap, 'pending');
      processStatus(completedSnap, 'completed');
      processStatus(rejectedSnap, 'rejected');

      history.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      return res.status(200).json(history.slice(0, 10));
    }

    // ===== WITHDRAW =====
    if (action === 'withdraw') {
      const { userId, userName, amount, method, account } = req.body;

      if (!userId || !amount) {
        return res.status(400).json({ error: 'Invalid parameters' });
      }

      const userRef = ref(db, `users/${userId}`);
      const userSnapshot = await get(userRef);
      const user = userSnapshot.val();

      if (!user || user.balance < amount) {
        return res.status(400).json({ error: 'Insufficient balance' });
      }

      // Create withdrawal request
      const withdrawRef = push(ref(db, 'withdrawals/pending'));
      await set(withdrawRef, {
        userId,
        userName,
        amount,
        method,
        account,
        timestamp: Date.now(),
        status: 'pending',
      });

      // Deduct from user balance
      await update(userRef, {
        balance: user.balance - amount,
      });

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
