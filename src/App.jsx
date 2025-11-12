import './App.css'
import { PDFProcessor } from './Core';
import Main from './Core2';
import FlipBook from './FlipBook';

function App() {

  return (
    <>
      <div style={{ background:'#f0f2f5'}}>
        <FlipBook src='/link.pdf' />
      </div>
    </>
  )
}

export default App
