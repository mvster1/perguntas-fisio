-- toda pergunta precisa estar completa para servir ao jogo: enunciado, as quatro
-- alternativas, a letra da correta, o texto dela, disciplina, dificuldade e dica.
-- aplicado no painel; declarado aqui para o historico reproduzir o esquema real.
alter table perguntas
  alter column pergunta    set not null,
  alter column resposta    set not null,
  alter column disciplina  set not null,
  alter column alt_a       set not null,
  alter column alt_b       set not null,
  alter column alt_c       set not null,
  alter column alt_d       set not null,
  alter column dificuldade set not null,
  alter column dica_bonus  set not null,
  alter column correta     set not null,
  alter column created_at  set not null;
