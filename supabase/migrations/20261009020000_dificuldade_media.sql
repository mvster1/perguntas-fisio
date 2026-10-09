-- a dificuldade continua fora do formulario, mas volta a ser obrigatoria: o
-- cliente grava sempre 'Média', e o que tiver ficado null vira 'Média' tambem
update perguntas
   set dificuldade = 'Média'
 where dificuldade is null;

alter table perguntas
  alter column dificuldade set default 'Média',
  alter column dificuldade set not null;
