import { Link } from "react-router-dom";

function Header() {
	return (
		<div>
			<span style={{ color: "white" }}>
				<Link to={"/"} style={{ color: "white" }}>
					home
				</Link>
				|
				<Link to={"/curriculum"} style={{ color: "white" }}>
					curriculum
				</Link>
				|
				<Link to={"/blog"} style={{ color: "white" }}>
					blog
				</Link>
			</span>
		</div>
	);
}

export default Header;
