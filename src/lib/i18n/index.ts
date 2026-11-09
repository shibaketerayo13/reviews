// Словари всех языков. Подключаются только на сервере; в браузер уходит словарь одного языка.
import type { Locale } from "./config";
import { ru, type Dict } from "./dictionaries/ru";
import { be } from "./dictionaries/be";
import { pl } from "./dictionaries/pl";
import { en } from "./dictionaries/en";

export type { Dict };

export const DICTIONARIES: Record<Locale, Dict> = { ru, be, pl, en };
