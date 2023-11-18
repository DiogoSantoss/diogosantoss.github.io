import { Routes, Route } from "react-router-dom";
import Gifs from "./components/Gifs";
import Header from "./components/Header";
import Home from "./pages/Home";
import Blog from "./pages/Blog";

function App() {
  return (
    <>
      <div className="flex items-center flex-col font-terminal my-10">
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/blog" element={<Blog />} />
        </Routes>
        <Gifs />
      </div>
    </>
  );
}

export default App;
