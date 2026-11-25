#!/usr/bin/env bash
# install.sh - set up the one-way Ventura -> Orbique FMS sync on Ventura's server.
#
#   bash install.sh            1) download the sync program, 2) make a MySQL login that can only READ the 'ventura'
#                              database, 3) make the settings file (without the FMS key: you paste that yourself)
#   bash install.sh --test     one dry run: reads the database and says what it would send; sends nothing
#   bash install.sh --start    one real run now, then every 5 minutes from cron
#   bash install.sh --stop     stops the 5-minute runs (FMS keeps what it has)
#   bash install.sh --remove   stops it and removes the program, its settings and the read-only MySQL login
#
# It never changes Ventura's app, code, database tables or files. The only things it adds on this server:
#   /opt/ventura-sync (program), /etc/ventura-sync (settings, root only), /var/lib/ventura-sync (what was sent),
#   /etc/cron.d/ventura-sync (only after --start), /var/log/ventura-sync.log, MySQL login 'fms_sync' (SELECT only).
set -u -o pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run it as root (or with sudo)."; exit 1; }
COMMIT=285451738607947799a27b99898ba6f67ee8290c
RAW=https://raw.githubusercontent.com/arnobmridha90/orbiquefms-website/$COMMIT/tools
DIR=/opt/ventura-sync; CONF=/etc/ventura-sync; STATE=/var/lib/ventura-sync
PY="/usr/bin/python3 -I $DIR/ventura-sync/ventura_sync.py --config $CONF/env"
DEB=/etc/mysql/debian.cnf
q() { mysql --defaults-file=$DEB -N -B -e "$1"; }

case "${1:-}" in
  --test)  $PY --dry-run; exit $? ;;
  --start)
    grep -q '^FMS_SERVICE_KEY=.\+' $CONF/env || { echo "Paste the FMS key into $CONF/env first (nano $CONF/env)."; exit 1; }
    echo "First run (the first one sends everything; photos follow in 300 MB slices every 5 minutes)..."
    $PY | tee -a /var/log/ventura-sync.log
    echo "2-59/5 * * * * root $PY >> /var/log/ventura-sync.log 2>&1" > /etc/cron.d/ventura-sync
    chmod 644 /etc/cron.d/ventura-sync
    echo "STARTED: it now runs every 5 minutes. Progress: tail /var/log/ventura-sync.log"; exit 0 ;;
  --stop)  rm -f /etc/cron.d/ventura-sync; echo "STOPPED (FMS keeps what it has)."; exit 0 ;;
  --remove)
    rm -f /etc/cron.d/ventura-sync; rm -rf $DIR $CONF $STATE
    q "DROP USER IF EXISTS 'fms_sync'@'localhost';" && echo "REMOVED: program, settings and the read-only login are gone."; exit 0 ;;
  "") ;;
  *) echo "Unknown option $1 (see the top of this file)"; exit 2 ;;
esac

command -v python3 >/dev/null || { echo "FAILED: python3 is missing"; exit 1; }
python3 -c 'import sys; sys.exit(sys.version_info < (3, 8))' || { echo "FAILED: python3 is older than 3.8"; exit 1; }

echo "== 1. Program ($COMMIT)"
mkdir -p $DIR/ventura-sync/vendor $DIR/ventura-import
while read -r sum path; do
  dest=$DIR/$path; mkdir -p "$(dirname "$dest")"
  curl -fsSL "$RAW/$path" -o "$dest.new" || { echo "FAILED: could not download $path"; exit 1; }
  echo "$sum  $dest.new" | sha256sum -c --quiet || { echo "FAILED: $path is not the expected file"; rm -f "$dest.new"; exit 1; }
  mv "$dest.new" "$dest"
done <<'SUMS'
c3afac81ca9ba9f2ba89d2efe20701d2af622c78b5fad38e92c99c337194a08b ventura-sync/ventura_sync.py
4de15da4c61dc132f4fb9ab763063e693d521a80fd0e87943b9a453dd4c19d6c ventura-sync/vendor/PyMySQL-1.1.1-py3-none-any.whl
1c3bb36378e377a16647a59af5cbb27b2acf4a103ee8b129c1a6bf4a763c7cb8 ventura-import/ventura_export.py
SUMS
chmod -R go-w $DIR; echo "   ok"

echo "== 2. Read-only MySQL login 'fms_sync'"
mkdir -p $CONF; chmod 700 $CONF
SOCK=$(q "SELECT @@socket") || { echo "FAILED: cannot log in to MySQL with $DEB"; exit 1; }
if [ ! -s $CONF/my.cnf ]; then
  P=$(head -c 32 /dev/urandom | sha256sum | cut -c1-40)
  q "CREATE USER IF NOT EXISTS 'fms_sync'@'localhost' IDENTIFIED BY '$P'; ALTER USER 'fms_sync'@'localhost' IDENTIFIED BY '$P';" || { echo "FAILED: could not create the login"; exit 1; }
  (umask 077; printf '[client]\nuser=fms_sync\npassword=%s\nsocket=%s\n' "$P" "$SOCK" > $CONF/my.cnf); unset P
fi
q "GRANT SELECT ON \`ventura\`.* TO 'fms_sync'@'localhost';" || { echo "FAILED: could not give it read access"; exit 1; }
echo "   ok: $(q "SHOW GRANTS FOR 'fms_sync'@'localhost'" | grep -c 'SELECT ON') read grant, no other rights"

echo "== 3. Settings file $CONF/env"
mkdir -p $STATE; chmod 700 $STATE
if [ ! -s $CONF/env ]; then
  (umask 077; cat > $CONF/env <<CFG
MYSQL_DEFAULTS=$CONF/my.cnf
MYSQL_DB=ventura
FMS_URL=https://sxrbrmdbaczhluwlbupn.supabase.co
FMS_SLUG=ventura
MEDIA_ROOT=/var/www/ventura-api/media
PRIVATE_MEDIA_ROOT=$(grep -s '^PRIVATE_MEDIA_ROOT=.\+' /var/www/ventura-api/.env | cut -d= -f2- | tr -d '"' || true)
STATE_DIR=$STATE
FILE_BUDGET_MB=300
FMS_SERVICE_KEY=
CFG
  )
  sed -i 's#^PRIVATE_MEDIA_ROOT=$#PRIVATE_MEDIA_ROOT=/var/www/ventura-api/media_private#' $CONF/env
fi
echo "   ok"
echo
echo "INSTALLED (not running yet). Next: nano $CONF/env, paste the FMS key after FMS_SERVICE_KEY=, save,"
echo "then: bash $0 --test"
