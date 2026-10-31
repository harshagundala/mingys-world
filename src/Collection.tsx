import "./collection.css";
const titles = [
  {
    id: "puppies",
    number: "01",
    title: "Mingy’s World",
    genre: "A mystery for two",
    image: "/posters/mingys-world.webp",
    light: true,
  },
  {
    id: "last-light",
    number: "02",
    title: "The Last Light",
    genre: "An autumn adventure for two",
    image: "/posters/last-light.webp",
    light: false,
  },
];
export default function Collection() {
  return (
    <main className="collection">
      <header className="collection-header">
        <h1>Games</h1>
      </header>
      <section className="collection-shelf" aria-label="Choose a game">
        {titles.map((t) => (
          <a
            className={`collection-card ${t.light ? "light" : ""}`}
            href={`/${t.id}`}
            key={t.id}
            aria-label={`Play ${t.title}`}
          >
            <div className="collection-poster">
              <img src={t.image} alt="" loading="eager" />
              <div className="collection-poster-title">
                <span>A MINGY ORIGINAL</span>
                <h2>{t.title}</h2>
              </div>
              <span className="collection-play">
                Play <span aria-hidden="true">↗</span>
              </span>
            </div>
            <div className="collection-caption">
              <span>{t.title}</span>
              <span>{t.number}</span>
            </div>
          </a>
        ))}
      </section>
    </main>
  );
}
