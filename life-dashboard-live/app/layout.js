import './globals.css';

export const metadata = {
  title: 'My Life Dashboard',
  description: 'Personal life-management dashboard'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
