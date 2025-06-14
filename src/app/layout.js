import './globals.css';
import ProvidersWrapper from '../components/ProvidersWrapper';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ProvidersWrapper>
          {children}
        </ProvidersWrapper>
      </body>
    </html>
  );
}