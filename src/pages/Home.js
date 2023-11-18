import { useEffect } from "react";

import WebRing from "../components/WebRing";

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

  const links = [
    {
      name: "microservices architecture deployed on GKE",
      url: "https://github.com/DiogoSantoss/nvolopi",
    },
    {
      name: "instrumentation of java applications in AWS",
      url: "https://github.com/DiogoSantoss/cloud-computing-virtualization",
    },
    {
      name: "secure infrastructure with JWT and 2FA",
      url: "https://github.com/DiogoSantoss/2fa-stock-broker",
    },
    {
      name: "state machine replication using QBFT",
      url: "hhttps://github.com/DiogoSantoss/permissioned-blockchain-qbft",
    },
    {
      name: "multi-paxos implementation",
      url: "https://github.com/DiogoSantoss/fault-tolerant-bank",
    },
    {
      name: "gossip architecture",
      url: "https://github.com/DiogoSantoss/nvolopi",
    },
  ];

  return (
    <>
      <div className="bg-githubDark text-white rounded-xl p-5 shadow-homeShadow">
        <h1 className="font-bold text-2xl">🌍 Diogo Santos</h1>
        <span>
          Student, aspiring software engineer <br /> <br />
          Writing my master thesis on byzantine fault tolerant algorithms <br />
          and distributed validator technology for Ethereum
        </span>
        <h3 className="font-bold text-xl mt-5 mb-1">Stuff I like</h3>
        <ul className="ml-5">
          <li>Distributed systems (proud Lamport fanboy)</li>
          <li>DevOps and Cloud ☁️</li>
          <li>Linux 🗿</li>
          <li>Tech-bro activities (gym 🏋🏻‍♂️ and bouldering 🪨)</li>
        </ul>
        <h3 className="font-bold text-xl mt-5 mb-1">Professional experience</h3>
        <div className="ml-5">
          <ul>
            <li>(Sep 2022 - Present ) Software Engineer @ IST</li>
            <li>(Jul 2023 - Aug 2023) Software Engineer Intern @ Jungle</li>
            <li>(Oct 2021 - Mar 2022) Outsourcing consultant @ JUNITEC</li>
            <li>
              (Jul 2021 - Sep 2021) Front-End Developer Intern @ Spin.Works
            </li>
          </ul>
          <p className="mt-3">Check LinkedIn or curriculum for more details</p>
        </div>
        <h3 className="font-bold text-xl mt-5 mb-1">Github projects</h3>
        <ul className="ml-5">
          {links.map((item, index) => (
            <li key={index}>
              <a href={item.url}>
                <span className="hover:underline">{item.name}</span>
                <span className="underline-none"> 🔗</span>
              </a>
            </li>
          ))}
        </ul>
        <div className="text-right">
          <span>
            <a
              href="https://www.linkedin.com/in/diogo-silva-santos/"
              className="inline-block mr-2"
            >
              <img
                src="https://skills.thijs.gg/icons?i=linkedin"
                alt="Linkedin"
              />
            </a>
            <a
              href="https://www.github.com/DiogoSantoss"
              className="inline-block"
            >
              <img src="https://skills.thijs.gg/icons?i=github" alt="Github" />
            </a>
          </span>
        </div>
        <WebRing />
      </div>
    </>
  );
}

export default Home;
