export type DirectorProfile = {
  image: string;
  bio: string;
  filmography?: string[];
};

const defaultImage =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Generic_Silhouette.png/480px-Generic_Silhouette.png';

const directorProfiles: Record<string, DirectorProfile> = {
  'Steven Spielberg': {
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Steven_Spielberg_by_Gage_Skidmore.jpg/640px-Steven_Spielberg_by_Gage_Skidmore.jpg',
    bio:
      'Director estadounidense clave del blockbuster moderno, creador de aventuras icónicas y relatos históricos de gran escala.',
    filmography: [
      'Jaws',
      'Close Encounters of the Third Kind',
      'Raiders of the Lost Ark',
      'E.T. the Extra-Terrestrial',
      'Jurassic Park',
      "Schindler's List",
      'Saving Private Ryan',
      'Minority Report',
      'Catch Me If You Can',
      'War of the Worlds',
    ],
  },
  'Peter Jackson': {
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Peter_Jackson_SDCC_2014.jpg/640px-Peter_Jackson_SDCC_2014.jpg',
    bio:
      'Cineasta neozelandés que trasladó la fantasía épica de la Tierra Media al cine, combinando efectos prácticos y digitales innovadores.',
    filmography: [
      'Heavenly Creatures',
      'The Lord of the Rings: The Fellowship of the Ring',
      'The Lord of the Rings: The Two Towers',
      'The Lord of the Rings: The Return of the King',
      'King Kong',
      'The Hobbit: An Unexpected Journey',
      'The Hobbit: The Desolation of Smaug',
      'The Hobbit: The Battle of the Five Armies',
    ],
  },
  'Ridley Scott': {
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Ridley_Scott_by_Gage_Skidmore.jpg/640px-Ridley_Scott_by_Gage_Skidmore.jpg',
    bio:
      'Esteta del sci-fi y el histórico, conocido por mundos densos y atmósferas cargadas que mezclan tecnología y misticismo.',
    filmography: [
      'Alien',
      'Blade Runner',
      'Legend',
      'Gladiator',
      'Kingdom of Heaven',
      'Prometheus',
      'The Martian',
      'Napoleon',
    ],
  },
  'James Cameron': {
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/James_Cameron_by_Gage_Skidmore.jpg/640px-James_Cameron_by_Gage_Skidmore.jpg',
    bio: 'Ingeniero narrativo del cine de acción y ciencia ficción, pionero en efectos visuales y mundos submarinos.',
    filmography: [
      'The Terminator',
      'Aliens',
      'The Abyss',
      'Terminator 2: Judgment Day',
      'True Lies',
      'Titanic',
      'Avatar',
      'Avatar: The Way of Water',
    ],
  },
  'Christopher Nolan': {
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Christopher_Nolan_Cannes_2018.jpg/640px-Christopher_Nolan_Cannes_2018.jpg',
    bio: 'Constructor de puzzles temporales y thrillers densos, combina grandes formatos con narrativas no lineales.',
    filmography: [
      'Memento',
      'Insomnia',
      'Batman Begins',
      'The Dark Knight',
      'Inception',
      'Interstellar',
      'Dunkirk',
      'Tenet',
      'Oppenheimer',
    ],
  },
};

export const getDirectorProfile = (name: string): DirectorProfile => {
  const entry = directorProfiles[name];
  if (entry) return entry;
  const match = Object.entries(directorProfiles).find(([key]) =>
    key.toLowerCase() === name.toLowerCase()
  );
  if (match) return match[1];
  return {
    image: defaultImage,
    bio: 'Autor con huella propia en la colección. Añade más detalles en el futuro para completar su perfil.',
    filmography: [],
  };
};
