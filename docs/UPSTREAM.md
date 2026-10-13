# Procedencia y cambios locales

La base de las skills Superpowers es obra/superpowers 7.0.0, commit
bb92a777 (identificador corto del registro original .superpowers-source.json).
Se conserva la licencia MIT incluida en el repositorio.

Esta copia tiene adaptaciones locales: activación manual para Codex, OpenCode y
Copilot; referencias sin prefijo de plugin; política proporcional en using-superpowers;
brainstorming opcional y compatible con el flujo SDD. Los nombres propios terminan
en -m minúscula. security-audit-m y los adaptadores son propios de Mi.agents.

Una actualización de upstream debe revisarse como diff. No reemplaces skills/
completo: perderías estas adaptaciones y las cuatro skills propias. Después de
actualizar ejecuta el validador, las pruebas y vuelve a instalar los adaptadores.
