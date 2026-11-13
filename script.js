const OMDB_API_KEY = window.OMDB_API_KEY || "";
const DEFAULT_QUERY = "Marvel";
const MAX_PAGES = 5; // OMDb returns 10 results per page; cap requests per search
const POSTER_PLACEHOLDER =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">' +
      '<rect width="300" height="450" fill="#222"/>' +
      '<text x="150" y="215" fill="#999" font-family="sans-serif" font-size="20" text-anchor="middle">Movie Poster</text>' +
      '<text x="150" y="245" fill="#999" font-family="sans-serif" font-size="20" text-anchor="middle">Not Available</text>' +
      "</svg>"
  );

const searchForm = document.querySelector("#searchForm");
const searchInput = document.querySelector("#searchInput");
const moviesGrid = document.querySelector("#moviesGrid");
const resultsInfo = document.querySelector("#resultsInfo");
const sortSelect = document.querySelector("#sortSelect");

let currentMovies = [];
let latestRequestId = 0;

const fallbackMovies = [
  {
    Title: "The Avengers",
    Year: "2012",
    Poster:
      "https://m.media-amazon.com/images/M/MV5BNGE0YTVjNzUtNzJjOS00NGNlLTgxMzctZTY4YTE1Y2Y1ZTU4XkEyXkFqcGc@._V1_QL75_UX380_CR0,0,380,562_.jpg",
  },
  {
    Title: "Avengers: Endgame",
    Year: "2019",
    Poster:
      "https://m.media-amazon.com/images/M/MV5BMWEyNDM2ZmQtMmFkNi00MTQ1LTk1MjItMzdlZGJlYmIyYzZlXkEyXkFqcGc@._V1_QL75_UX380_CR0,0,380,562_.jpg",
  },
  {
    Title: "Avengers: Infinity War",
    Year: "2018",
    Poster:
      "https://m.media-amazon.com/images/M/MV5BMjMxNjY2MDU1OV5BMl5BanBnXkFtZTgwNzY1MTUwNTM@._V1_QL75_UX380_CR0,0,380,562_.jpg",
  },
  {
    Title: "Avengers: Age of Ultron",
    Year: "2015",
    Poster:
      "https://m.media-amazon.com/images/M/MV5BODBhYTg1NGQtNGVmNS00ZTdiLThjYTYtZDFkNzRiNTZmNDZjXkEyXkFqcGc@._V1_QL75_UX380_CR0,0,380,562_.jpg",
  },
  {
    Title: "The Avengers",
    Year: "1998",
    Poster:
      "https://m.media-amazon.com/images/M/MV5BZTA4ZmZlZWQtZDRlYS00ZWZhLTk0MzEtYjExMGIzMTBlZDNlXkEyXkFqcGc@._V1_SX300.jpg",
  },
  {
    Title: "Captain America: The First Avenger",
    Year: "2011",
    Poster: POSTER_PLACEHOLDER,
  },
  { Title: "Iron Man", Year: "2008", Poster: POSTER_PLACEHOLDER },
  {
    Title: "Guardians of the Galaxy",
    Year: "2014",
    Poster: POSTER_PLACEHOLDER,
  },
];

function createSkeletonCards(count = 10) {
  moviesGrid.innerHTML = Array.from(
    { length: count },
    () => `
      <div class="movie-card movie-card--skeleton" aria-hidden="true">
        <div class="movie-card__img--skeleton"></div>
        <div class="movie-card__title--skeleton"></div>
        <div class="movie-card__year--skeleton"></div>
      </div>
    `
  ).join("");
}

function normalizeYear(value) {
  const year = Number.parseInt(value, 10);
  return Number.isFinite(year) ? year : 0;
}

function sortMovies(movies, sortValue) {
  const sortedMovies = [...movies];

  switch (sortValue) {
    case "a-z":
      return sortedMovies.sort((a, b) => a.Title.localeCompare(b.Title));
    case "z-a":
      return sortedMovies.sort((a, b) => b.Title.localeCompare(a.Title));
    case "newest":
      return sortedMovies.sort(
        (a, b) => normalizeYear(b.Year) - normalizeYear(a.Year)
      );
    case "oldest":
      return sortedMovies.sort(
        (a, b) => normalizeYear(a.Year) - normalizeYear(b.Year)
      );
    default:
      return sortedMovies;
  }
}

function displayMovies(movies) {
  moviesGrid.replaceChildren();

  if (movies.length === 0) {
    const message = document.createElement("p");
    message.className = "movie-card__poster-placeholder";
    message.textContent = "No movies found for this search.";
    moviesGrid.append(message);
    return;
  }

  const movieCards = movies.map((movie) => {
    const title = movie.Title || "Untitled Movie";
    const card = document.createElement("article");
    card.className = "movie-card";

    const poster = document.createElement("img");
    poster.className = "movie-card__img";
    poster.src =
      movie.Poster && movie.Poster !== "N/A"
        ? movie.Poster
        : POSTER_PLACEHOLDER;
    poster.alt = `${title} poster`;
    poster.loading = "lazy";
    poster.addEventListener(
      "error",
      () => {
        poster.src = POSTER_PLACEHOLDER;
      },
      { once: true }
    );

    const heading = document.createElement("h2");
    heading.className = "movie-card__title";
    heading.textContent = title;

    const year = document.createElement("p");
    year.className = "movie-card__year";
    year.textContent = movie.Year || "N/A";

    card.append(poster, heading, year);
    return card;
  });

  moviesGrid.append(...movieCards);
}

async function fetchMoviePage(searchTerm, page) {
  if (!OMDB_API_KEY) {
    throw new Error("Add an OMDb API key to config.js to search movies.");
  }

  const response = await fetch(
    `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&s=${encodeURIComponent(searchTerm)}&page=${page}`
  );

  if (!response.ok) {
    throw new Error(`OMDb request failed with status ${response.status}.`);
  }

  const data = await response.json();
  if (data.Response !== "True" || !Array.isArray(data.Search)) {
    throw new Error(data.Error || "The movie search returned no results.");
  }

  return data;
}

async function fetchMovies(query) {
  const searchTerm = query.trim() || DEFAULT_QUERY;
  const requestId = ++latestRequestId;
  resultsInfo.textContent = `Showing: ${searchTerm}`;

  try {
    // Render the first page right away instead of waiting for every page.
    const firstPage = await fetchMoviePage(searchTerm, 1);
    if (requestId !== latestRequestId) return; // a newer search started

    currentMovies = [...firstPage.Search];
    displayMovies(sortMovies(currentMovies, sortSelect.value));

    const totalResults = Number.parseInt(firstPage.totalResults, 10);
    const totalPages = Math.min(
      Number.isFinite(totalResults) ? Math.ceil(totalResults / 10) : 1,
      MAX_PAGES
    );
    if (totalPages <= 1) return;

    // Load the remaining pages in parallel; a failed page is skipped, not fatal.
    const pageNumbers = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
    const results = await Promise.allSettled(
      pageNumbers.map((page) => fetchMoviePage(searchTerm, page))
    );
    if (requestId !== latestRequestId) return;

    const seen = new Set(currentMovies.map((movie) => movie.imdbID));
    results.forEach((result) => {
      if (result.status !== "fulfilled") return;
      result.value.Search.forEach((movie) => {
        if (!seen.has(movie.imdbID)) {
          seen.add(movie.imdbID);
          currentMovies.push(movie);
        }
      });
    });

    displayMovies(sortMovies(currentMovies, sortSelect.value));
  } catch (error) {
    if (requestId !== latestRequestId) return;

    if (error.message === "Movie not found!") {
      currentMovies = [];
      resultsInfo.textContent = `No results for: ${searchTerm}`;
      displayMovies(currentMovies);
      return;
    }

    console.warn("OMDb search failed; showing matching sample results.", error);
    currentMovies = fallbackMovies.filter((movie) =>
      movie.Title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    resultsInfo.textContent = currentMovies.length
      ? `Showing sample results for: ${searchTerm} (OMDb unavailable)`
      : `OMDb unavailable; no sample results for: ${searchTerm}`;
    displayMovies(sortMovies(currentMovies, sortSelect.value));
  }
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sortSelect.value = "default";
  createSkeletonCards();
  fetchMovies(searchInput.value);
});

sortSelect.addEventListener("change", () => {
  displayMovies(sortMovies(currentMovies, sortSelect.value));
});

searchInput.value = DEFAULT_QUERY;
createSkeletonCards();
fetchMovies(DEFAULT_QUERY);
