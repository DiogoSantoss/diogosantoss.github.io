import { Routes, Route } from "react-router-dom";
import Gifs from "./components/Gifs";
import WebRing from "./components/WebRing";
import Header from "./components/Header";
import Home from "./pages/Home";
import Blog from "./pages/Blog";

function App() {
	return (
		<>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					paddingTop: "30px",
					fontFamily: "Terminal, monospace",
					flexFlow: "column",
				}}
			>
				<Header/>
				<Routes>
					<Route path="/" element={<Home />} />
					<Route path="/blog" element={<Blog/>} />
				</Routes>
				<Gifs/>
				<WebRing/>
			</div>
		</>
	);
}

export default App;
