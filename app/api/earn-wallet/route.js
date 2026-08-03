// app/api/earn-wallet/route.js

const DB_URL = process.env.FIREBASE_DATABASE_URL;
const DB_SECRET = process.env.FIREBASE_DB_SECRET;

async function dbFetch(path, method = 'GET', body = null) {
  const url = `${DB_URL}/${path}.json?auth=${DB_SECRET}`;
  const options = { method };
  if (body) options.body = JSON.stringify(body);
  if (method !== 'GET') options.headers = { 'Content-Type': 'application/json' };

  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`Firebase error: ${res.status}`);
  return res.json();
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const userId = searchParams.get('id');

    if (!DB_URL || !DB_SECRET) {
      return Response.json({ error: 'Server Config Missing' }, { status: 500 });
    }

    let result = {};

    if (action === 'getConfig') {
      result = await dbFetch('config');
      return Response.json(result);
    }

    if (action === 'getHistory') {
      const pending = await dbFetch('withdrawals/pending');
      const completed = await dbFetch('withdrawals/completed');
      const rejected = await dbFetch('withdrawals/rejected');

      let history = [];
      const process = (obj, status) => {
        if (!obj) return;
        Object.values(obj).forEach((item) => {
          if (String(item.userId) === String(userId)) {
            history.push({ ...item, status });
          }
        });
      };

      process(pending, 'pending');
      process(completed, 'completed');
      process(rejected, 'rejected');
      history.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      return Response.json(history.slice(0, 10));
    }

    if (action === 'getLeaderboard') {
      const users = await dbFetch('users');
      if (users) {
        const sorted = Object.values(users)
          .sort((a, b) => (b.referrals || 0) - (a.referrals || 0))
          .slice(0, 20)
          .map((u) => ({
            id: u.id,
            firstName: u.firstName,
            photoUrl: u.photoUrl,
            referrals: u.referrals || 0,
          }));
        return Response.json(sorted);
      }
      return Response.json([]);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('API Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const action = body.action;

    if (!DB_URL || !DB_SECRET) {
      return Response.json({ error: 'Server Config Missing' }, { status: 500 });
    }

    let result = {};

    if (action === 'login') {
      const { id, firstName, photoUrl, refId } = body;
      if (!id) return Response.json({ error: 'Missing user ID' }, { status: 400 });

      let user = await dbFetch(`users/${id}`);

      if (!user) {
        const config = await dbFetch('config');
        const bonus = config?.referralBonus || 0;

        user = {
          id,
          firstName: firstName || 'User',
          photoUrl: photoUrl || '',
          referrals: 0,
          balance: 0,
          totalEarned: 0,
          createdAt: Date.now(),
        };

        if (refId && refId !== id) {
          const referrer = await dbFetch(`users/${refId}`);
          if (referrer) {
            await dbFetch(`users/${refId}`, 'PATCH', {
              balance: (referrer.balance || 0) + bonus,
              referrals: (referrer.referrals || 0) + 1,
            });
          }
        }

        await dbFetch(`users/${id}`, 'PUT', user);
      } else {
        if (photoUrl && user.photoUrl !== photoUrl) {
          await dbFetch(`users/${id}/photoUrl`, 'PUT', photoUrl);
          user.photoUrl = photoUrl;
        }
      }

      return Response.json({
        id: user.id,
        firstName: user.firstName,
        photoUrl: user.photoUrl,
        referrals: user.referrals || 0,
        balance: user.balance || 0,
        totalEarned: user.totalEarned || 0,
      });
    }

    if (action === 'updateBalance') {
      const { id, amount } = body;
      if (!id || typeof amount !== 'number') {
        return Response.json({ error: 'Invalid parameters' }, { status: 400 });
      }

      const user = await dbFetch(`users/${id}`);
      if (!user) {
        return Response.json({ error: 'User not found' }, { status: 404 });
      }

      const newBalance = (user.balance || 0) + amount;
      const newEarned = (user.totalEarned || 0) + amount;

      await dbFetch(`users/${id}`, 'PATCH', {
        balance: newBalance,
        totalEarned: newEarned,
      });

      return Response.json({ success: true, newBalance });
    }

    if (action === 'withdraw') {
      const { userId, userName, amount, method, account } = body;
      if (!userId || !amount) {
        return Response.json({ error: 'Invalid parameters' }, { status: 400 });
      }

      const user = await dbFetch(`users/${userId}`);
      if (!user || user.balance < amount) {
        return Response.json({ error: 'Insufficient balance' }, { status: 400 });
      }

      await dbFetch('withdrawals/pending', 'POST', {
        userId,
        userName,
        amount,
        method,
        account,
        timestamp: Date.now(),
        status: 'pending',
      });

      await dbFetch(`users/${userId}`, 'PATCH', {
        balance: user.balance - amount,
      });

      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('API Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
