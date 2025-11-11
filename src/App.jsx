import './App.css'
import FlipBook from './FlipBook';

function App() {

  return (
    <>
      <div style={{ background:'#f0f2f5'}}>
        <FlipBook src="/src/assets/c.pdf" width={1000} height={700} />
      </div>
    </>
  )
}

export default App
