import { Routes, Route } from 'react-router'
import Layout from './components/Layout'
import Home from './pages/Home'
import Logs from './pages/Logs'
import ComingSoon from './pages/ComingSoon'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="logs" element={<Logs />} />
        <Route path="logs/:service" element={<Logs />} />
        <Route path="*" element={<ComingSoon />} />
      </Route>
    </Routes>
  )
}
