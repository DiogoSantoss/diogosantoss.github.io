import { Routes, Route } from "react-router-dom";
import Gifs from "./components/Gifs";
import Header from "./components/Header";
import Home from "./pages/Home";
import Curriculum from "./pages/Curriculum";
import Blog from "./pages/Blog";

function App() {
	return (
		<>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					height: "100vh",
					fontFamily: "Terminal, monospace",
					flexFlow: "column",
				}}
			>
				<Header/>
				<Routes>
					<Route path="/" element={<Home />} />
					<Route path="/curriculum" element={<Curriculum/>} />
					<Route path="/blog" element={<Blog/>} />
				</Routes>
				<Gifs/>
			</div>
		</>
	);
}

export default App;
