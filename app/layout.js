export const metadata = {
  title: 'Vulnerability Scanner',
  description: 'Sistema de análisis de seguridad de código',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}
