FROM postgres:18.6-alpine AS hardened

# Três remoções, todas verificadas por scan de imagem (ver DECISIONS.md, "Segurança"):
#
# 1. gosu: a imagem oficial o usa só para trocar de root para postgres. É compilado
#    com uma versão antiga do Go e concentrava a maior parte das CVEs. Rodando direto
#    como postgres, o entrypoint não precisa dele.
# 2. curl: não é usado por nada na imagem.
# 3. libcurl + libpq-oauth: o módulo de OAuth do libpq (novo no PostgreSQL 18) é o único
#    usuário do libcurl. A conexão da API usa senha, nunca OAuth. O pacote virtual de
#    dependências do Postgres é recriado sem o libcurl, para o apk continuar consistente.
RUN set -eux; \
  apk upgrade --no-cache; \
  apk del --no-cache curl; \
  rm -f /usr/local/bin/gosu; \
  rundeps="$(apk info | grep '^\.postgresql-rundeps')"; \
  apk add --no-cache --virtual .fastmeals-postgresql-rundeps \
    $(apk info -R "$rundeps" | tail -n +2 | grep -v '^so:libcurl'); \
  apk del --no-cache "$rundeps"; \
  rm -f /usr/local/lib/libpq-oauth-*.so; \
  ! apk info -e libcurl

# Apagar arquivos numa camada nova só os esconde: continuariam dentro das camadas da
# imagem base. Copiar o sistema de arquivos final para uma imagem vazia remove-os de
# fato. Em troca, a configuração da imagem oficial é repetida abaixo.
FROM scratch
COPY --from=hardened / /

ENV PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
  LANG=en_US.utf8 \
  PG_MAJOR=18 \
  PG_VERSION=18.6 \
  PGDATA=/var/lib/postgresql/18/docker

VOLUME /var/lib/postgresql
EXPOSE 5432
STOPSIGNAL SIGINT
USER postgres
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["postgres"]
