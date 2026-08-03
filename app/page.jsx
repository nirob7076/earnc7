// app/page.jsx
import EarnWallet from '@/components/EarnWallet';

export const metadata = {
  title: 'Earn Wallet - Watch Ads & Earn Money',
  description: 'Earn money by watching ads and completing tasks in Telegram Mini App',
  viewport: 'width=device-width, initial-scale=1.0, user-scalable=no',
};

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <EarnWallet />
    </main>
  );
}
