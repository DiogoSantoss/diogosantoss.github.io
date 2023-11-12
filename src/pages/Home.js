import { useEffect } from "react";

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
    //h: "#181c26",
    h: "#ffffff",
    text: "#ffffff",
  };

  return (
    <>
      <div
        style={{
          backgroundColor: "#6d6d6d",
          backgroundColor: "#242938",
          boxShadow: "0 0 2px 2px grey",
          borderRadius: "10px",
          padding: "20px",
          margin: "1vh",
        }}
      >
        <h2 style={{ color: colorScheme.h, margin: "0" }}>🌍 Diogo Santos</h2>
        <span style={{ color: colorScheme.text }}>
          Student, aspiring software engineer <br /> <br />
          Writing my master thesis on byzantine fault tolerant algorithms <br />
          and distributed validator technology for Ethereum
        </span>
        <h3 style={{ color: colorScheme.h, marginBottom: "0" }}>
          Stuff I like
        </h3>
        <ul style={{ listStyle: "none", padding: "0 0 0 10px" }}>
          <li style={{ color: colorScheme.text }}>
            Distributed systems (proud Lamport fanboy)
          </li>
          <li style={{ color: colorScheme.text }}>DevOps and Cloud ☁️</li>
          <li style={{ color: colorScheme.text }}>Linux 🗿</li>
          <li style={{ color: colorScheme.text }}>
            Tech-bro activities (gym 🏋🏻‍♂️ and bouldering 🪨)
          </li>
        </ul>
        <h3 style={{ color: colorScheme.h, marginBottom: "0" }}>
          Professional experience
        </h3>
        <ul style={{ listStyle: "none", padding: "0 0 0 10px" }}>
          <li
            style={{
              color: colorScheme.text,
            }}
            >
            (Sep 2022 - Present ) Full Stack Developer @ IST 
          </li>
          <li
            style={{
              color: colorScheme.text,
            }}
          >
            (Jul 2023 - Aug 2023) Software Engineer Intern @ Jungle 
          </li>
          <li
            style={{
              color: colorScheme.text,
            }}
          >
            (Oct 2021 - Mar 2022) Outsourcing consultant @ JUNITEC 
          </li>
          <li
            style={{
              color: colorScheme.text,
            }}
          >
            (Jul 2021 - Sep 2021) Front-End Developer Intern @ Spin.Works 
          </li>
        </ul>
        <span style={{ padding: "0 0 0 10px", color: colorScheme.text }}>
          Check LinkedIn or curriculum for more details
        </span>
        <h3 style={{ color: colorScheme.h, marginBottom: "0" }}>
          Github projects
        </h3>
        <ul
          style={{
            listStyle: "none",
            padding: "0 0 0 10px",
            color: colorScheme.text,
          }}
        >
          <li>
            <a
              style={{ color: colorScheme.text }}
              href="https://github.com/DiogoSantoss/nvolopi"
            >
              microservices architecture deployed on GKE
            </a>
          </li>
          <li>
            <a
              style={{ color: colorScheme.text }}
              href="https://github.com/DiogoSantoss/2fa-stock-broker"
            >
              secure infrastructure with JWT and 2FA
            </a>
          </li>
          <li>
            <a
              style={{ color: colorScheme.text }}
              href="https://github.com/DiogoSantoss/permissioned-blockchain-qbft"
            >
              state machine replication using QBFT
            </a>
          </li>
          <li>
            <a
              style={{ color: colorScheme.text }}
              href="https://github.com/DiogoSantoss/fault-tolerant-bank"
            >
              multi-paxos implementation
            </a>
          </li>
          <li>
            <a
              style={{ color: colorScheme.text }}
              href="https://github.com/DiogoSantoss/gossip-architecture-grpc"
            >
              gossip architecture
            </a>
          </li>
        </ul>
        <span style={{ float: "right" }}>
          <a
            style={{ marginRight: "1em" }}
            href="https://www.linkedin.com/in/diogo-silva-santos/"
          >
            <img
              src="https://skills.thijs.gg/icons?i=linkedin"
              alt="Linkedin"
            />
          </a>
          <a href="https://www.github.com/DiogoSantoss">
            <img src="https://skills.thijs.gg/icons?i=github" alt="Github" />
          </a>
        </span>
      </div>
    </>
  );
}

export default Home;
