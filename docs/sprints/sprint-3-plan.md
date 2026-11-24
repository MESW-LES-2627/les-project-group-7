# Plano do Sprint 3 (Iteration 3)

Group 7 · Iteration 3 (20 Nov a 4 Dez 2026, igual ao campo Iteration do board #20)

Regras da retrospective da Iteration 2: nenhum PR é merged sem aprovação de um colega, um PR cobre um issue ("Part of #N"), o freeze é mantido, o pipeline corre, o início do sprint tem tag, e alguém que não é o autor usa o produto em `dev` na primeira semana.

Regra deste sprint: **uma story só entra se todas as suas tasks entram, e nenhuma epic fica a meio.** O que não cabe inteiro fica inteiro para a Iteration 4.

## Calendário

| Data       | Marco                                                                                  |
| :--------- | :------------------------------------------------------------------------------------- |
| Ter 24 Nov | Planning, ok às estimativas, tag `sprint-3-start`                                      |
| Qui 26 Nov | #66 e #146 merged: desbloqueiam o #67. #144 merged: desbloqueia o #145                 |
| Sex 27 Nov | `docs/iterations/3/usability.md` (uma pessoa que não é autora usa o demo em `dev`)     |
| Seg 30 Nov | Checkpoint: board e PRs abertos de cada membro                                         |
| Qua 2 Dez  | Freeze: nada novo de uma story é merged depois deste dia                               |
| Qui 3 Dez  | Só fixes da review. `prod` pronto para a review                                        |
| Sex 4 Dez  | Fim da iteração, demo e retrospective                                                  |

## Stories fechadas inteiras nesta iteração

| Epic | Story | Tasks (todas) |
| :--- | :---- | :------------ |
| E4 | #58 US-E4-01 Build an itinerary by hand | #144, #145 (as restantes já estão merged) |
| E5 | #62 US-E5-01 Nearby suggestions | #63, #64 |
| E6 | #65 US-E6-01 Warn outside opening hours or hour limits | #66, #146, #67 |
| E6 | #68 US-E6-02 Average price vs budget | #69, #70 |
| E7 | #71 US-E7-01 Walking time between stops | #72 |
| P1 | #77 US-P1-01 Any browser and phone | #78 |
| P2 | #79 US-P2-01 Dev and prod environments | #80 |

## Issues e responsáveis

As estimativas ficam para o planning: cada um estima os seus.

| Responsável      | Issues                                                                      |
| :--------------- | :-------------------------------------------------------------------------- |
| GalaxyXYZ888     | #144 Settings API, #146 Hour-limits check, #80 Pipeline (co-owner)          |
| joaopachecowork1 | #66 Opening-hours check, #63 Nearby ranking, #64 Suggestions panel, #80     |
| mclcavalcante    | #78 Responsive, #145 Settings box, #72 Estimates in the day view            |
| JorgeCaldas78    | #69 Trip average, #70 Average in the trip view, #67 Warning on the stop     |

## Ordem por pessoa

| Quem             | Semana 1 (24–27 Nov)                 | Semana 2 (30 Nov–2 Dez)                |
| :--------------- | :----------------------------------- | :------------------------------------- |
| GalaxyXYZ888     | #144 e #146 (merge até qui 26), #80  | #80 merged                             |
| joaopachecowork1 | #66 (merge até qui 26), #63          | #64, revisão do #80                    |
| mclcavalcante    | #78                                  | #145 depois do #144, #72               |
| JorgeCaldas78    | #69                                  | #70, #67 depois do #66 e do #146       |

## Dependências

- #67 espera pelo #66 e pelo #146. #145 espera pelo #144. #64 espera pelo #63. #70 espera pelo #69.
- #72 e #67 usam a Stops API, que já está merged.

## Fora da Iteration 3 (inteiro na Iteration 4)

- E8 #73 e as tasks #74, #75, #76 e #147. Depende de #144, #146 e #66.
- D2 #47 a #52 (listas).
- As stories Stretch (S1 a S19).

## Risco

- Se o #66 ou o #146 falharem o merge de quinta 26, o #67 e a story #65 não fecham. Nesse caso decide-se no checkpoint de 30 Nov, e a story inteira passa para a Iteration 4 em vez de ficar a meio.
