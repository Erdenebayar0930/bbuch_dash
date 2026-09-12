import React from "react";

interface AvatarTextProps {
  name: string;
  className?: string;
}

const AvatarText: React.FC<AvatarTextProps> = ({ name, className = "" }) => {
  // Generate initials from name
  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Generate a consistent pastel color based on the name
  const getColorClass = (name: string) => {
    const colors = [
      "bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400",
      "bg-pink-100 text-pink-600 dark:bg-pink-500/15 dark:text-pink-500-dark",
      "bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400",
      "bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400",
      "bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-400",
      "bg-purple-100 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400",
      "bg-yellow-100 text-yellow-600 dark:bg-yellow-500/15 dark:text-yellow-400",
      "bg-error-100 text-error-600 dark:bg-error-500/15 dark:text-error-400",
    ];

    const index = name
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  return (
    <div
      className={`flex h-10 w-10 ${className} items-center justify-center rounded-full ${getColorClass(
        name
      )}`}
    >
      <span className="text-sm font-medium">{initials}</span>
    </div>
  );
};

export default AvatarText;
