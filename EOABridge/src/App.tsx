import Header from './components/Header'
import Footer from './components/Footer'

function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">
            EOABridge
          </h1>
          <p className="text-gray-600 text-center mb-8">
            Upgrade your EOA to a MetaMask Smart Account instantly.
            <br />
            <span className="text-primary font-semibold">Zero Gas Fees.</span>
          </p>
          
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-12 text-center">
            <p className="text-gray-500">Upgrade Wizard Loading...</p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default App
