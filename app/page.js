export default function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        background: 'white',
        padding: '3rem',
        borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        maxWidth: '600px',
        textAlign: 'center'
      }}>
        <h1 style={{
          fontSize: '3rem',
          margin: '0 0 1rem 0',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          🔒 Vulnerability Scanner v2.0
        </h1>
        
        <p style={{
          fontSize: '1.2rem',
          color: '#666',
          marginBottom: '2rem'
        }}>
          Sistema de análisis de seguridad de código con GitHub Actions
        </p>

        <div style={{
          background: '#f8f9fa',
          padding: '2rem',
          borderRadius: '10px',
          marginBottom: '2rem'
        }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
            ✨ Características
          </h2>
          
          <div style={{ textAlign: 'left', color: '#555' }}>
            <p>✅ Escaneo automático de vulnerabilidades</p>
            <p>✅ Detección de lenguajes: Java, JavaScript, Python, C, C#</p>
            <p>✅ Integración con GitHub Actions</p>
            <p>✅ Notificaciones en Telegram</p>
            <p>✅ Auto-merge a main si es seguro</p>
          </div>
        </div>

        <div style={{
          background: '#e7f3ff',
          padding: '1.5rem',
          borderRadius: '10px',
          border: '2px solid #667eea'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#667eea' }}>
            📊 Estado del Proyecto
          </h3>
          <p style={{ margin: 0, color: '#555' }}>
            Proyecto de Desarrollo de Software Seguro
          </p>
        </div>
      </div>

      <footer style={{
        marginTop: '2rem',
        color: 'white',
        textAlign: 'center'
      }}>
        <p>Made with ❤️ using Next.js + GitHub Actions</p>
      </footer>
    </div>
  )
}
