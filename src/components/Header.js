import { Link } from "react-router-dom";

function Header() {
	return (
		<div>
			<span style={{ color: "white" }}>
				<Link to={"/"} style={{ color: "inherit", textDecoration: "none" }}>
					home
				</Link>
				|
				<a href="cv-diogo-santos.pdf" style={{ color: "inherit", textDecoration: "none" }}>
					curriculum
				</a>
				|
				<Link to={"/blog"} style={{ color: "inherit", textDecoration: "none" }}>
					blog
				</Link>
			</span>
		</div>
	);
}

export default Header;
