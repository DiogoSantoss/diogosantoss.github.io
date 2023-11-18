import { Link } from "react-router-dom";

function Header() {
  return (
    <>
      <div className="text-lg text-white font-bold">
        <Link className="hover:underline" to={"/"}>
          home
        </Link>
        |
        <a href="cv-diogo-santos.pdf" className="hover:underline">
          curriculum
        </a>
        |
        <Link to={"/blog"} className="hover:underline">
          blog
        </Link>
      </div>
    </>
  );
}

export default Header;
