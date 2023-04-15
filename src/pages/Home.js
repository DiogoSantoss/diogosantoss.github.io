import { useEffect } from "react";

function linearGradient(start, middle, end) {
	return `linear-gradient(90deg, ${start} 0%, ${middle} 50%, ${end} 100%)`;
}

function Home() {
	useEffect(() => {
		const mad = [
			" inspect element ? ",
			"⣞⢽⢪⢣⢣⢣⢫⡺⡵⣝⡮⣗⢷⢽⢽⢽⣮⡷⡽⣜⣜⢮⢺⣜⢷⢽⢝⡽⣝",
			"⠸⡸⠜⠕⠕⠁⢁⢇⢏⢽⢺⣪⡳⡝⣎⣏⢯⢞⡿⣟⣷⣳⢯⡷⣽⢽⢯⣳⣫⠇",
			"⠀⠀⢀⢀⢄⢬⢪⡪⡎⣆⡈⠚⠜⠕⠇⠗⠝⢕⢯⢫⣞⣯⣿⣻⡽⣏⢗⣗⠏",
			"⠀⠪⡪⡪⣪⢪⢺⢸⢢⢓⢆⢤⢀⠀⠀⠀⠀⠈⢊⢞⡾⣿⡯⣏⢮⠷⠁",
			"⠀⠀⠀⠈⠊⠆⡃⠕⢕⢇⢇⢇⢇⢇⢏⢎⢎⢆⢄⠀⢑⣽⣿⢝⠲⠉",
			"⠀⠀⠀⠀⠀⡿⠂⠠⠀⡇⢇⠕⢈⣀⠀⠁⠡⠣⡣⡫⣂⣿⠯⢪⠰⠂",
			"⠀⠀⠀⠀⡦⡙⡂⢀⢤⢣⠣⡈⣾⡃⠠⠄⠀⡄⢱⣌⣶⢏⢊⠂",
			"⠀⠀⠀⠀⢝⡲⣜⡮⡏⢎⢌⢂⠙⠢⠐⢀⢘⢵⣽⣿⡿⠁⠁",
			"⠀⠀⠀⠀⠨⣺⡺⡕⡕⡱⡑⡆⡕⡅⡕⡜⡼⢽⡻⠏",
			"⠀⠀⠀⠀⣼⣳⣫⣾⣵⣗⡵⡱⡡⢣⢑⢕⢜⢕⡝",
			"⠀⠀⠀⣴⣿⣾⣿⣿⣿⡿⡽⡑⢌⠪⡢⡣⣣⡟",
			"⠀⠀⠀⡟⡾⣿⢿⢿⢵⣽⣾⣼⣘⢸⢸⣞⡟",
			"⠀⠀⠀⠀⠁⠇⠡⠩⡫⢿⣝⡻⡮⣒⢽⠋",
		];
		console.log(mad.join("\n"));
	}, []);

	const colorScheme = {
		background: "#a3679a",
		border: "#ffc693",
		h: "#000000",
		text: "#000000",
		start: "#a3679a",
		middle: "#ffc693",
		end: "#3878fe",
	};

	return (
		<>
			<div
				style={{
					backgroundImage: linearGradient(
						colorScheme.start,
						colorScheme.middle,
						colorScheme.end
					),
					border: "3px solid " + colorScheme.border,
					borderRadius: "10px",
					padding: "20px",
					margin: "1vh",
				}}
			>
				<h2 style={{ color: colorScheme.h, margin: "0" }}>🌍 Didas</h2>
				<span style={{ color: colorScheme.text }}>
					Student, aspiring software engineer
				</span>
				<h3 style={{ color: colorScheme.h, marginBottom: "0" }}>
					What I like doing
				</h3>
				<ul style={{ margin: "0" }}>
					<li style={{ color: colorScheme.text }}>
						Pretending I know why my Arch broke 🗿
					</li>
					<li style={{ color: colorScheme.text }}>
						Using WSL because it just works
					</li>
					<li style={{ color: colorScheme.text }}>
						Distributed systems and reading Lamport website
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
							gossip architecture
						</a>
					</li>
					<li style={{ color: colorScheme.text }}>
						<a href="https://github.com/DiogoSantoss/fault-tolerant-bank">
							multi-paxos attempt
						</a>
					</li>
					<li style={{ color: colorScheme.text }}>
						<a href="https://github.com/DiogoSantoss/2fa-stock-broker">
							vms pretending to be a secure infrastructure
						</a>
					</li>
					<li style={{ color: colorScheme.text }}>
						<a href="https://github.com/DiogoSantoss/persistent-web-server-go">
							experimenting go
						</a>
					</li>
				</ul>
				<h3 style={{ color: colorScheme.h, marginBottom: "0" }}>Socials</h3>
				<ul style={{ margin: "0" }}>
					<li style={{ color: colorScheme.text }}>
						<a href="https://github.com/DiogoSantoss/"> octocat app </a>
					</li>
					<li style={{ color: colorScheme.text }}>
						<a href="https://twitter.com/l_Didas_l"> bird app </a>
					</li>
					<li style={{ color: colorScheme.text }}>
						<a href="https://www.linkedin.com/in/diogo-silva-santos/">
							business app
						</a>
					</li>
				</ul>

				<h3> </h3>
				<span style={{ float: "right" }}>
					<a href="https://tecnico.ulisboa.pt" target="_blank" rel="noreferrer">
						<img src="ist.png" alt="ist" height="20" width="20" />
					</a>
					mepp bad
				</span>
			</div>
		</>
	);
}

export default Home;
