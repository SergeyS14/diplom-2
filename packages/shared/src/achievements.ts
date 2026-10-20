export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_game', title: 'Дебют', description: 'Сыграть первую игру', icon: '🎮' },
  { id: 'first_win', title: 'Чемпион', description: 'Занять первое место', icon: '🥇' },
  { id: 'podium', title: 'Подиум', description: 'Войти в тройку', icon: '🏅' },
  { id: 'streak_3', title: 'В ударе', description: 'Три верных ответа подряд', icon: '🔥' },
  { id: 'perfect_round', title: 'Без ошибок', description: 'Весь раунд ответить верно', icon: '💎' },
  { id: 'speed', title: 'Молния', description: 'Верный ответ быстрее двух секунд', icon: '⚡' },
  { id: 'games_10', title: 'Завсегдатай', description: 'Сыграть 10 игр', icon: '🎯' },
  { id: 'score_5k', title: 'Тяжеловес', description: 'Набрать 5000 очков за игру', icon: '⭐' },
  { id: 'author', title: 'Автор', description: 'Опубликовать свой квиз', icon: '📝' },
];

export function achievementById(id: string) {
  return ACHIEVEMENTS.find((item) => item.id === id);
}
