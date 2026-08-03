import './globals.css'

export const metadata = {
  title: 'Earn Wallet - আয় করুন বিজ্ঞাপন দেখে',
  description: 'Earn money by watching ads and completing tasks in Telegram Mini App',
  viewport: 'width=device-width, initial-scale=1.0, user-scalable=no',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet" />
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
      </head>
      <body className="bg-gray-50">
        {children}
      </body>
    </html>
  )
}
