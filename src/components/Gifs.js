function Gifs() {

  const gifs = [
    "bestviewedyour.gif",
    "cdrom.gif",
    "powered.gif",
    "service.gif",
    "archlinux.gif",
  ]

  return (
    <div class="flex flex-wrap justify-center items-center">
      {gifs.map((gif) => (
        <img src={gif} alt={gif} class="h-31 w-88 mt-3" />
      ))}
    </div>
  );
}

export default Gifs;
