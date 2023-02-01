import "../styles/rainbow.css";

function Blog() {
	return (
		<>
			<div style={{margin: "1vh"}}>
				<h1 style={{ textAlign: "center" }}>
					🚧
					<span className="rainbow">Under Construction</span>
					🚧
				</h1>
				<img
					src="lethimcook.jpg"
					alt="lethimcook"
					style={{ 
						width: "50%",
						display: "block",
						marginLeft: "auto",
						marginRight: "auto",
					}}
				></img>
			</div>
		</>
	);
}

export default Blog;
