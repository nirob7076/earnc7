'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TrendingUp, Zap, Gift, LogOut, Copy, Share2, Phone, Loader, Smartphone } from 'lucide-react';

const EarnWallet = () => {
  // ===== STATE =====
  const [appState, setAppState] = useState({
    user: null,
    config: {},
    history: [],
    leaderboard: [],
    page: 'p-home',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [buttonLocks, setButtonLocks] = useState({});
  const [spinReward, setSpinReward] = useState(null);
  const [spinHistory, setSpinHistory] = useState([]);
  const tgRef = useRef(null);

  // ===== TELEGRAM WEBAPP INIT =====
  useEffect(() => {
    const initTelegram = () => {
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        tgRef.current = tg;
        tg.ready();
        tg.expand();
        tg.disableVerticalSwipes();
        return tg;
      }
      return null;
    };

    const tg = initTelegram();

    const loadApp = async () => {
      try {
        const data = tg?.initData || '';
        const params = new URLSearchParams(data);
        const userId = JSON.parse(params.get('user') || '{}').id || 'test_user_123';
        const firstName = JSON.parse(params.get('user') || '{}').first_name || 'User';
        const photoUrl = JSON.parse(params.get('user') || '{}').photo_url || '';
        const refId = params.get('start_param') || null;

        // Fetch Config
        const configRes = await fetch(`/api/earn-wallet?action=getConfig`);
        const config = await configRes.json();

        // Login/Register
        const loginRes = await fetch(`/api/earn-wallet`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'login',
            id: userId,
            firstName,
            photoUrl,
            refId,
          }),
        });
        const user = await loginRes.json();

        setAppState((prev) => ({
          ...prev,
          user,
          config: config || {},
        }));

        // Load history
        const histRes = await fetch(`/api/earn-wallet?action=getHistory&id=${userId}`);
        const history = await histRes.json();
        setAppState((prev) => ({
          ...prev,
          history: Array.isArray(history) ? history : [],
        }));

        setIsLoading(false);
      } catch (error) {
        console.error('Init Error:', error);
        setIsLoading(false);
      }
    };

    loadApp();
  }, []);

  // ===== HELPERS =====
  const lockButton = useCallback((id) => {
    setButtonLocks((prev) => ({ ...prev, [id]: true }));
  }, []);

  const unlockButton = useCallback((id) => {
    setButtonLocks((prev) => ({ ...prev, [id]: false }));
  }, []);

  const showToast = (message) => {
    alert(message); // Replace with better toast in production
  };

  const isButtonLocked = (id) => buttonLocks[id] === true;

  // ===== WATCH AD =====
  const watchAd = async (adId, reward) => {
    if (isButtonLocked(adId)) return;
    lockButton(adId);

    try {
      // Update Balance Server-Side
      const res = await fetch(`/api/earn-wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateBalance',
          id: appState.user.id,
          amount: reward,
        }),
      });

      const result = await res.json();

      if (result.success) {
        setAppState((prev) => ({
          ...prev,
          user: {
            ...prev.user,
            balance: prev.user.balance + reward,
            totalEarned: prev.user.totalEarned + reward,
          },
        }));
        showToast(`+${reward} ${appState.config.currencySymbol || 'TK'}`);
        if (tgRef.current?.HapticFeedback) {
          tgRef.current.HapticFeedback.notificationOccurred('success');
        }
      }
    } finally {
      unlockButton(adId);
    }
  };

  // ===== WATCH AD FOR TASK =====
  const completeTask = async (taskId, reward) => {
    if (isButtonLocked(taskId)) return;
    lockButton(taskId);

    try {
      const res = await fetch(`/api/earn-wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateBalance',
          id: appState.user.id,
          amount: reward,
        }),
      });

      const result = await res.json();

      if (result.success) {
        setAppState((prev) => ({
          ...prev,
          user: {
            ...prev.user,
            balance: prev.user.balance + reward,
            totalEarned: prev.user.totalEarned + reward,
          },
        }));
        showToast(`Task Completed! +${reward} ${appState.config.currencySymbol || 'TK'}`);
        if (tgRef.current?.HapticFeedback) {
          tgRef.current.HapticFeedback.notificationOccurred('success');
        }
      }
    } finally {
      unlockButton(taskId);
    }
  };

  // ===== SPIN WHEEL =====
  const spinWheel = async () => {
    const spinId = `spin-${Date.now()}`;
    if (isButtonLocked(spinId)) return;
    lockButton(spinId);

    try {
      // Generate random reward (3-4-6 TK)
      const rewards = appState.config.spinRewards || [3, 4, 6];
      const reward = rewards[Math.floor(Math.random() * rewards.length)];

      // Update balance
      const res = await fetch(`/api/earn-wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateBalance',
          id: appState.user.id,
          amount: reward,
        }),
      });

      const result = await res.json();

      if (result.success) {
        setSpinReward(reward);
        setSpinHistory((prev) => [{ reward, timestamp: Date.now() }, ...prev.slice(0, 9)]);
        setAppState((prev) => ({
          ...prev,
          user: {
            ...prev.user,
            balance: prev.user.balance + reward,
            totalEarned: prev.user.totalEarned + reward,
          },
        }));
        showToast(`Spin Won! +${reward} ${appState.config.currencySymbol || 'TK'}`);
        if (tgRef.current?.HapticFeedback) {
          tgRef.current.HapticFeedback.notificationOccurred('success');
        }

        setTimeout(() => setSpinReward(null), 3000);
      }
    } finally {
      unlockButton(spinId);
    }
  };

  // ===== WITHDRAW =====
  const withdraw = async () => {
    const withdrawId = 'withdraw-btn';
    if (isButtonLocked(withdrawId)) return;

    const minRef = appState.config.minWithdrawReferrals || 0;
    if (appState.user.referrals < minRef) {
      showToast(`Need ${minRef} Referrals!`);
      return;
    }

    const amount = parseFloat(prompt('Enter amount:') || '0');
    if (!amount || amount < 10) {
      showToast(`Min 10 ${appState.config.currencySymbol || 'TK'}`);
      return;
    }

    if (amount > appState.user.balance) {
      showToast('Insufficient Balance');
      return;
    }

    lockButton(withdrawId);

    try {
      const res = await fetch(`/api/earn-wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'withdraw',
          userId: appState.user.id,
          userName: appState.user.firstName,
          amount,
          method: 'default',
          account: 'account',
        }),
      });

      const result = await res.json();

      if (result.success) {
        setAppState((prev) => ({
          ...prev,
          user: {
            ...prev.user,
            balance: prev.user.balance - amount,
          },
        }));
        showToast('Withdrawal Submitted!');
        if (tgRef.current?.HapticFeedback) {
          tgRef.current.HapticFeedback.notificationOccurred('success');
        }
      }
    } finally {
      unlockButton(withdrawId);
    }
  };

  // ===== COPY REFERRAL LINK =====
  const copyRef = () => {
    const refLink = `https://t.me/${appState.config.botUsername || 'your_bot'}?start=${appState.user.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(refLink);
      showToast('Referral Link Copied!');
    }
  };

  // ===== SHARE REFERRAL =====
  const shareRef = () => {
    const refLink = `https://t.me/${appState.config.botUsername || 'your_bot'}?start=${appState.user.id}`;
    if (tgRef.current?.openTelegramLink) {
      tgRef.current.openTelegramLink(`https://t.me/share/url?url=${refLink}&text=Join Earn Wallet and Make Money!`);
    }
  };

  // ===== RENDER =====
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 relative">
            <div className="absolute inset-0 border-4 border-transparent border-t-cyan-400 border-r-purple-500 rounded-full animate-spin"></div>
            <div className="absolute inset-2 border-4 border-transparent border-b-pink-400 border-l-cyan-300 rounded-full animate-spin-reverse"></div>
          </div>
          <p className="text-white text-lg font-bold tracking-widest">Loading...</p>
        </div>
      </div>
    );
  }

  if (!appState.user) {
    return <div className="p-4 text-center">Error loading app</div>;
  }

  // ===== HOME PAGE =====
  const HomePage = () => (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-600 via-purple-500 to-indigo-600 rounded-3xl p-8 text-white shadow-xl">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <img
              src={appState.user.photoUrl || 'https://via.placeholder.com/50'}
              alt="User"
              className="w-12 h-12 rounded-full border-2 border-white"
            />
            <div>
              <h3 className="font-bold text-lg">{appState.user.firstName}</h3>
              <p className="text-sm opacity-90">Level 1</p>
            </div>
          </div>
          <button className="bg-white/20 backdrop-blur-md p-3 rounded-full hover:bg-white/30 transition">
            <Phone className="w-5 h-5" />
          </button>
        </div>

        {/* Balance Card */}
        <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20">
          <p className="text-xs uppercase tracking-widest opacity-90">Available Balance</p>
          <h2 className="text-4xl font-bold mt-2 mb-4">{appState.user.balance}</h2>
          <div className="flex justify-between text-sm">
            <div>
              <p className="opacity-75">Earned</p>
              <p className="font-bold text-lg">{appState.user.totalEarned}</p>
            </div>
            <div>
              <p className="opacity-75">Referrals</p>
              <p className="font-bold text-lg">{appState.user.referrals}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Watch Ads Section */}
      <div className="px-4">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-purple-600" />
          Watch Ads
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {(appState.config.adReward ? [{ id: 'ad-1', title: 'Video Ad', icon: '🎬' }] : []).map((ad) => (
            <button
              key={ad.id}
              onClick={() => watchAd(ad.id, appState.config.adReward || 5)}
              disabled={isButtonLocked(ad.id)}
              className={`p-6 rounded-2xl text-center font-bold transition-all transform ${
                isButtonLocked(ad.id)
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
                  : 'bg-gradient-to-br from-purple-100 to-indigo-100 hover:shadow-lg active:scale-95 cursor-pointer'
              }`}
            >
              <div className="text-3xl mb-2">{ad.icon}</div>
              <p className="text-sm">{ad.title}</p>
              <p className="text-lg text-purple-600">+{appState.config.adReward || 5}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Spin Wheel Section */}
      <div className="px-4">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Gift className="w-5 h-5 text-purple-600" />
          Spin Wheel
        </h3>
        <button
          onClick={spinWheel}
          disabled={isButtonLocked(`spin-${Date.now()}`)}
          className={`w-full p-6 rounded-2xl font-bold transition-all transform ${
            isButtonLocked(`spin-${Date.now()}`)
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
              : 'bg-gradient-to-r from-pink-500 to-purple-600 hover:shadow-lg text-white active:scale-95 cursor-pointer'
          }`}
        >
          🎡 SPIN NOW!
        </button>
        {spinReward && (
          <div className="mt-4 p-4 bg-green-100 border border-green-400 rounded-xl text-center font-bold text-green-700">
            Won +{spinReward} {appState.config.currencySymbol || 'TK'}!
          </div>
        )}
      </div>

      {/* Withdraw Button */}
      <div className="px-4">
        <button
          onClick={withdraw}
          disabled={isButtonLocked('withdraw-btn')}
          className={`w-full p-4 rounded-xl font-bold transition-all ${
            isButtonLocked('withdraw-btn')
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
              : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-lg active:scale-95'
          }`}
        >
          Withdraw
        </button>
      </div>
    </div>
  );

  // ===== REFERRAL PAGE =====
  const ReferralPage = () => (
    <div className="space-y-6 pb-6">
      <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-3xl p-8 text-white text-center">
        <TrendingUp className="w-12 h-12 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Earn Extra</h2>
        <p className="opacity-90">Share your link and earn commission</p>
      </div>

      <div className="px-4 space-y-4">
        {/* Referral Link Box */}
        <div className="bg-white p-4 rounded-2xl shadow-md">
          <p className="text-sm text-gray-600 mb-2">Your Referral Link:</p>
          <input
            type="text"
            readOnly
            value={`https://t.me/${appState.config.botUsername || 'your_bot'}?start=${appState.user.id}`}
            className="w-full p-3 bg-gray-100 rounded-lg text-sm border border-gray-300 mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={copyRef}
              className="flex-1 flex items-center justify-center gap-2 bg-purple-600 text-white p-3 rounded-lg font-bold hover:bg-purple-700"
            >
              <Copy className="w-4 h-4" /> Copy
            </button>
            <button
              onClick={shareRef}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700"
            >
              <Share2 className="w-4 h-4" /> Share
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-blue-100 to-blue-200 p-4 rounded-xl text-center">
            <p className="text-sm text-gray-600">Total Referrals</p>
            <p className="text-2xl font-bold text-blue-700">{appState.user.referrals}</p>
          </div>
          <div className="bg-gradient-to-br from-green-100 to-green-200 p-4 rounded-xl text-center">
            <p className="text-sm text-gray-600">Referral Bonus</p>
            <p className="text-2xl font-bold text-green-700">
              {(appState.user.referrals * (appState.config.referralBonus || 0))}
            </p>
          </div>
        </div>

        {/* Spin Wheel Under Referral */}
        <div className="mt-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Gift className="w-5 h-5 text-purple-600" />
            Daily Spin
          </h3>
          <button
            onClick={spinWheel}
            disabled={isButtonLocked(`spin-ref-${Date.now()}`)}
            className={`w-full p-6 rounded-2xl font-bold transition-all transform ${
              isButtonLocked(`spin-ref-${Date.now()}`)
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
                : 'bg-gradient-to-r from-pink-500 to-purple-600 hover:shadow-lg text-white active:scale-95 cursor-pointer'
            }`}
          >
            🎡 SPIN FOR REWARDS!
          </button>
        </div>

        {/* Spin History */}
        {spinHistory.length > 0 && (
          <div className="mt-6">
            <h4 className="font-bold mb-2">Recent Spins</h4>
            <div className="space-y-2">
              {spinHistory.map((spin, idx) => (
                <div key={idx} className="flex justify-between items-center bg-gray-100 p-3 rounded-lg">
                  <span className="text-sm">Spin #{spinHistory.length - idx}</span>
                  <span className="font-bold text-green-600">+{spin.reward}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ===== PROFILE PAGE =====
  const ProfilePage = () => (
    <div className="space-y-6 pb-6">
      <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-3xl p-8 text-white text-center">
        <img
          src={appState.user.photoUrl || 'https://via.placeholder.com/80'}
          alt="Profile"
          className="w-20 h-20 rounded-full border-4 border-white mx-auto mb-4"
        />
        <h2 className="text-2xl font-bold">{appState.user.firstName}</h2>
        <p className="opacity-90">ID: {appState.user.id}</p>
      </div>

      <div className="px-4 space-y-4">
        {/* Stats */}
        <div className="bg-white p-4 rounded-2xl shadow-md">
          <h3 className="font-bold mb-4">Statistics</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-gray-600">Total Earned</span>
              <span className="font-bold text-lg">{appState.user.totalEarned} TK</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-gray-600">Current Balance</span>
              <span className="font-bold text-lg">{appState.user.balance} TK</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Referrals</span>
              <span className="font-bold text-lg">{appState.user.referrals}</span>
            </div>
          </div>
        </div>

        {/* Withdrawal History */}
        <div className="bg-white p-4 rounded-2xl shadow-md">
          <h3 className="font-bold mb-4">Withdrawal History</h3>
          {appState.history.length > 0 ? (
            <div className="space-y-2">
              {appState.history.map((item, idx) => (
                <div key={idx} className={`p-3 rounded-lg border-l-4 ${
                  item.status === 'pending' ? 'border-yellow-500 bg-yellow-50' :
                  item.status === 'completed' ? 'border-green-500 bg-green-50' :
                  'border-red-500 bg-red-50'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className="font-bold">{item.amount} TK</span>
                    <span className={`text-xs font-bold uppercase ${
                      item.status === 'pending' ? 'text-yellow-600' :
                      item.status === 'completed' ? 'text-green-600' :
                      'text-red-600'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{new Date(item.timestamp).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500">No withdrawal history</p>
          )}
        </div>

        {/* Support */}
        <button
          onClick={() => {
            if (appState.config.supportLink) {
              window.open(appState.config.supportLink, '_blank');
            }
          }}
          className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold hover:bg-blue-700"
        >
          📞 Support
        </button>
      </div>
    </div>
  );

  // ===== MAIN RENDER =====
  const renderPage = () => {
    switch (appState.page) {
      case 'p-home':
        return <HomePage />;
      case 'p-referral':
        return <ReferralPage />;
      case 'p-profile':
        return <ProfilePage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100" style={{ paddingBottom: '100px' }}>
      {/* Content */}
      <div className="max-w-md mx-auto pt-4">
        {renderPage()}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-200 shadow-2xl">
        <div className="flex justify-around items-center h-20">
          <button
            onClick={() => setAppState((prev) => ({ ...prev, page: 'p-home' }))}
            className={`flex flex-col items-center gap-1 py-2 px-6 rounded-lg transition-all ${
              appState.page === 'p-home'
                ? 'text-purple-600'
                : 'text-gray-400'
            }`}
          >
            <Zap className="w-6 h-6" />
            <span className="text-xs font-bold">Home</span>
          </button>
          <button
            onClick={() => setAppState((prev) => ({ ...prev, page: 'p-referral' }))}
            className={`flex flex-col items-center gap-1 py-2 px-6 rounded-lg transition-all ${
              appState.page === 'p-referral'
                ? 'text-purple-600'
                : 'text-gray-400'
            }`}
          >
            <TrendingUp className="w-6 h-6" />
            <span className="text-xs font-bold">Refer</span>
          </button>
          <button
            onClick={() => setAppState((prev) => ({ ...prev, page: 'p-profile' }))}
            className={`flex flex-col items-center gap-1 py-2 px-6 rounded-lg transition-all ${
              appState.page === 'p-profile'
                ? 'text-purple-600'
                : 'text-gray-400'
            }`}
          >
            <Smartphone className="w-6 h-6" />
            <span className="text-xs font-bold">Profile</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default EarnWallet;
