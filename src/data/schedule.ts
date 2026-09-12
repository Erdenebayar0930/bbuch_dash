/**
 * Долоо хоногийн үйлчлэлийн хуваарь — хянах самбар дээр харагдах зурган постер.
 * Админ Firebase Storage руу зураг байршуулж, түүний URL-ыг хадгална.
 */

export type WeeklySchedulePoster = {
  imageUrl: string;
};

export const defaultWeeklySchedulePoster: WeeklySchedulePoster = {
  imageUrl: "",
};
