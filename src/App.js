import { useEffect } from "react";

function linearGradient(start, middle, end) {
  return `linear-gradient(90deg, ${start} 0%, ${middle} 50%, ${end} 100%)`;
}

function App() {
	useEffect(() => {
		const mad = [
			"⣞⢽⢪⢣⢣⢣⢫⡺⡵⣝⡮⣗⢷⢽⢽⢽⣮⡷⡽⣜⣜⢮⢺⣜⢷⢽⢝⡽⣝",
			"⠸⡸⠜⠕⠕⠁⢁⢇⢏⢽⢺⣪⡳⡝⣎⣏⢯⢞⡿⣟⣷⣳⢯⡷⣽⢽⢯⣳⣫⠇",
			"⠀⠀⢀⢀⢄⢬⢪⡪⡎⣆⡈⠚⠜⠕⠇⠗⠝⢕⢯⢫⣞⣯⣿⣻⡽⣏⢗⣗⠏⠀",
			"⠀⠪⡪⡪⣪⢪⢺⢸⢢⢓⢆⢤⢀⠀⠀⠀⠀⠈⢊⢞⡾⣿⡯⣏⢮⠷⠁⠀⠀",
			"⠀⠀⠀⠈⠊⠆⡃⠕⢕⢇⢇⢇⢇⢇⢏⢎⢎⢆⢄⠀⢑⣽⣿⢝⠲⠉⠀⠀⠀⠀",
			"⠀⠀⠀⠀⠀⡿⠂⠠⠀⡇⢇⠕⢈⣀⠀⠁⠡⠣⡣⡫⣂⣿⠯⢪⠰⠂⠀⠀⠀⠀",
			"⠀⠀⠀⠀⡦⡙⡂⢀⢤⢣⠣⡈⣾⡃⠠⠄⠀⡄⢱⣌⣶⢏⢊⠂⠀⠀⠀⠀⠀",
			"⠀⠀⠀⠀⢝⡲⣜⡮⡏⢎⢌⢂⠙⠢⠐⢀⢘⢵⣽⣿⡿⠁⠁⠀⠀⠀⠀",
			"⠀⠀⠀⠀⠨⣺⡺⡕⡕⡱⡑⡆⡕⡅⡕⡜⡼⢽⡻⠏⠀⠀⠀⠀⠀",
			"⠀⠀⠀⠀⣼⣳⣫⣾⣵⣗⡵⡱⡡⢣⢑⢕⢜⢕⡝⠀⠀⠀⠀",
			"⠀⠀⠀⣴⣿⣾⣿⣿⣿⡿⡽⡑⢌⠪⡢⡣⣣⡟⠀⠀⠀",
			"⠀⠀⠀⡟⡾⣿⢿⢿⢵⣽⣾⣼⣘⢸⢸⣞⡟⠀⠀",
			"⠀⠀⠀⠀⠁⠇⠡⠩⡫⢿⣝⡻⡮⣒⢽⠋⠀",
		];

		console.log(" inspect element ? ");
		mad.forEach((line) => console.log(line));
	}, []);

	const colorScheme = {
		background: "#a3679a",
		border: "#ffc693",
		h: "#FFFFFF",
		text: "#2a42ea",
    start: "#a3679a",
    middle: "#ffc693",
    end: "#3878fe",
	};

	return (
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
			<div
				style={{
					backgroundImage: linearGradient(colorScheme.start, colorScheme.middle, colorScheme.end),
					border: "3px solid " + colorScheme.border,
					borderRadius: "10px",
					padding: "20px",
				}}
			>
				<h2 style={{ color: colorScheme.h, margin: "0" }}>DiogoSantoss</h2>
				<span style={{ color: colorScheme.text }}>
					Student, not very bright league gamer, tf2 enjoyer
				</span>
				<h3 style={{ color: colorScheme.h, marginBottom: "0" }}>
					What I like doing
				</h3>
				<ul style={{ margin: "0" }}>
					<li style={{ color: colorScheme.text }}>Pretending I know Linux</li>
					<li style={{ color: colorScheme.text }}>
						Pretending I know Window (my main driver)
					</li>
					<li style={{ color: colorScheme.text }}>
						Distributed systems, consensus is great for election
					</li>
					<li style={{ color: colorScheme.text }}>
						Some security (iptables -P INPUT DROP is my main security defense)
					</li>
				</ul>
				<h3 style={{ color: colorScheme.h, marginBottom: "0" }}>
					Check some projects on my github
				</h3>
				<ul style={{ margin: "0" }}>
					<li style={{ color: colorScheme.text }}>
						<a href="https://github.com/DiogoSantoss/gossip-architecture-grpc">
							{" "}
							gossip architecture{" "}
						</a>
					</li>
					<li style={{ color: colorScheme.text }}>
						<a href="https://github.com/DiogoSantoss/fault-tolerant-bank">
							{" "}
							multi-paxos attempt{" "}
						</a>
					</li>
					<li style={{ color: colorScheme.text }}>
						<a href="https://github.com/DiogoSantoss/2fa-stock-broker">
							{" "}
							vms pretending to be a secure infrastructure{" "}
						</a>
					</li>
					<li style={{ color: colorScheme.text }}>
						<a href="https://github.com/DiogoSantoss/persistent-web-server-go">
							{" "}
							experimenting go{" "}
						</a>
					</li>
				</ul>
				<h3 style={{ marginBottom: "0" }}>Socials</h3>
				<ul style={{ margin: "0" }}>
					<li style={{ color: colorScheme.text }}>
						<a href="https://github.com/DiogoSantoss/"> octocat app </a>
					</li>
					<li style={{ color: colorScheme.text }}>
						<a href="https://twitter.com/l_Didas_l"> bird app </a>
					</li>
					<li style={{ color: colorScheme.text }}>
						<a href="https://www.linkedin.com/in/diogo-silva-santos/">
							{" "}
							business app{" "}
						</a>
					</li>
				</ul>
			</div>
			<div style={{ margin: "1vh" }}>
				<img
					src="bestviewedyour.gif"
					alt="bestviewedyour"
					height="31"
					width="88"
				/>
				<img src="cd_rom.gif" alt="cd_rom" height="31" width="88" />
				<img src="powered.gif" alt="powered" height="31" width="88" />
				<img src="service.gif" alt="service" height="31" width="88" />
				<img src="archlinux.gif" alt="archlinux" height="31" width="88" />
			</div>
		</div>
	);
}

export default App;
