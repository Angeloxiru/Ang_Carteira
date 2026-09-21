/* Identidade da versão em execução.

   O valor 'dev' é substituído pelo SHA do commit durante o deploy
   (.github/workflows/deploy.yml). Nada para manter à mão: cada deploy gera
   uma versão nova sozinho. Rodando local, continua 'dev'. */

export const APP_VERSION = 'dev';
