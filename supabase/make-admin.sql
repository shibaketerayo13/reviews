-- Сделать пользователя админом.
-- Сначала зарегистрируйтесь на сайте этим email, потом запустите в SQL Editor.
-- Замените email на свой.

update public.profiles
set is_admin = true
where id = (select id from auth.users where email = 'thioxtoa@gmail.com');

-- Проверка: должна вернуться одна строка с is_admin = true
select p.id, p.display_name, p.is_admin, u.email
from public.profiles p
join auth.users u on u.id = p.id
where p.is_admin;
