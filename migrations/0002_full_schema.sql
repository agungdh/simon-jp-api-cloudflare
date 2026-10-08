-- 0002_full_schema: ganti pegawai minimal -> full (ikut app Laravel lama),
-- tambah master + semua tabel aktivitas. Pre-production: DROP + CREATE ulang.
DROP TABLE IF EXISTS pegawai;

CREATE TABLE IF NOT EXISTS bidangs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bidang TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS pangkat_golongans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jenjang TEXT NOT NULL,
  pangkat TEXT NOT NULL,
  golongan TEXT NOT NULL,
  ruang TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS jenis_pelatihans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jenis_pelatihan TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS pegawai (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  bidang_id INTEGER REFERENCES bidangs(id),
  pangkat_golongan_id INTEGER REFERENCES pangkat_golongans(id),
  tipe TEXT NOT NULL DEFAULT 'pegawai' CHECK (tipe IN ('pegawai', 'admin')),
  status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'non aktif')),
  nip TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  jabatan TEXT,
  peran TEXT,
  kategori_jabatan TEXT CHECK (kategori_jabatan IN ('struktural', 'fungsional auditor', 'fungsional tertentu')),
  kategori_kebutuhan_jam_pelatihan TEXT CHECK (kategori_kebutuhan_jam_pelatihan IN ('admin', 'pejabat', 'auditor')),
  foto_key TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX IF NOT EXISTS idx_pegawai_nip ON pegawai(nip);
CREATE INDEX IF NOT EXISTS idx_pegawai_nama ON pegawai(nama);
CREATE INDEX IF NOT EXISTS idx_pegawai_status ON pegawai(status);
CREATE INDEX IF NOT EXISTS idx_pegawai_tipe ON pegawai(tipe);
CREATE INDEX IF NOT EXISTS idx_pegawai_bidang ON pegawai(bidang_id);
CREATE INDEX IF NOT EXISTS idx_pegawai_user ON pegawai(user_id);

CREATE TABLE IF NOT EXISTS diklats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pegawai_id INTEGER NOT NULL REFERENCES pegawai(id) ON DELETE CASCADE,
  jenis_pelatihan_id INTEGER NOT NULL REFERENCES jenis_pelatihans(id),
  nomor_surat TEXT NOT NULL,
  materi_pengembangan TEXT NOT NULL,
  dari_tanggal_pelaksanaan TEXT NOT NULL,
  sampai_tanggal_pelaksanaan TEXT NOT NULL,
  jumlah_jam_pelatihan INTEGER NOT NULL,
  filename TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX IF NOT EXISTS idx_diklats_pegawai ON diklats(pegawai_id);
CREATE INDEX IF NOT EXISTS idx_diklats_nomor ON diklats(nomor_surat);
CREATE INDEX IF NOT EXISTS idx_diklats_dari ON diklats(dari_tanggal_pelaksanaan);

CREATE TABLE IF NOT EXISTS ppms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pegawai_id INTEGER NOT NULL REFERENCES pegawai(id) ON DELETE CASCADE,
  nomor_surat TEXT NOT NULL,
  materi_pengembangan TEXT NOT NULL,
  tanggal_pelaksanaan TEXT NOT NULL,
  jumlah_jam_pelatihan INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX IF NOT EXISTS idx_ppms_pegawai ON ppms(pegawai_id);
CREATE INDEX IF NOT EXISTS idx_ppms_nomor ON ppms(nomor_surat);
CREATE INDEX IF NOT EXISTS idx_ppms_tanggal ON ppms(tanggal_pelaksanaan);

CREATE TABLE IF NOT EXISTS seminars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pegawai_id INTEGER NOT NULL REFERENCES pegawai(id) ON DELETE CASCADE,
  materi_pengembangan TEXT NOT NULL,
  tanggal_pelaksanaan TEXT NOT NULL,
  jumlah_jam INTEGER NOT NULL,
  filename TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX IF NOT EXISTS idx_seminars_pegawai ON seminars(pegawai_id);
CREATE INDEX IF NOT EXISTS idx_seminars_tanggal ON seminars(tanggal_pelaksanaan);

CREATE TABLE IF NOT EXISTS webinars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pegawai_id INTEGER NOT NULL REFERENCES pegawai(id) ON DELETE CASCADE,
  materi_pengembangan TEXT NOT NULL,
  tanggal_pelaksanaan TEXT NOT NULL,
  jumlah_jam INTEGER NOT NULL,
  filename TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX IF NOT EXISTS idx_webinars_pegawai ON webinars(pegawai_id);
CREATE INDEX IF NOT EXISTS idx_webinars_tanggal ON webinars(tanggal_pelaksanaan);

CREATE TABLE IF NOT EXISTS lcs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pegawai_id INTEGER NOT NULL REFERENCES pegawai(id) ON DELETE CASCADE,
  materi_pengembangan TEXT NOT NULL,
  tanggal_pelaksanaan TEXT NOT NULL,
  jumlah_jam INTEGER NOT NULL,
  filename TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX IF NOT EXISTS idx_lcs_pegawai ON lcs(pegawai_id);
CREATE INDEX IF NOT EXISTS idx_lcs_tanggal ON lcs(tanggal_pelaksanaan);

CREATE TABLE IF NOT EXISTS belajar_mandiris (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pegawai_id INTEGER NOT NULL REFERENCES pegawai(id) ON DELETE CASCADE,
  materi_pengembangan TEXT NOT NULL,
  tanggal_pelaksanaan TEXT NOT NULL,
  jumlah_jam INTEGER NOT NULL,
  filename TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX IF NOT EXISTS idx_belajar_mandiris_pegawai ON belajar_mandiris(pegawai_id);
CREATE INDEX IF NOT EXISTS idx_belajar_mandiris_tanggal ON belajar_mandiris(tanggal_pelaksanaan);

CREATE TABLE IF NOT EXISTS mentorings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pegawai_id INTEGER NOT NULL REFERENCES pegawai(id) ON DELETE CASCADE,
  materi_pengembangan TEXT NOT NULL,
  tanggal_pelaksanaan TEXT NOT NULL,
  jumlah_jam INTEGER NOT NULL,
  filename TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX IF NOT EXISTS idx_mentorings_pegawai ON mentorings(pegawai_id);
CREATE INDEX IF NOT EXISTS idx_mentorings_tanggal ON mentorings(tanggal_pelaksanaan);

CREATE TABLE IF NOT EXISTS coachings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pegawai_id INTEGER NOT NULL REFERENCES pegawai(id) ON DELETE CASCADE,
  materi_pengembangan TEXT NOT NULL,
  tanggal_pelaksanaan TEXT NOT NULL,
  jumlah_jam INTEGER NOT NULL,
  filename TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX IF NOT EXISTS idx_coachings_pegawai ON coachings(pegawai_id);
CREATE INDEX IF NOT EXISTS idx_coachings_tanggal ON coachings(tanggal_pelaksanaan);

CREATE TABLE IF NOT EXISTS workshops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pegawai_id INTEGER NOT NULL REFERENCES pegawai(id) ON DELETE CASCADE,
  materi_pengembangan TEXT NOT NULL,
  tanggal_pelaksanaan TEXT NOT NULL,
  jumlah_jam INTEGER NOT NULL,
  filename TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX IF NOT EXISTS idx_workshops_pegawai ON workshops(pegawai_id);
CREATE INDEX IF NOT EXISTS idx_workshops_tanggal ON workshops(tanggal_pelaksanaan);

CREATE TABLE IF NOT EXISTS materi_ppms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nomor_surat TEXT,
  nama_pemateri TEXT,
  materi_pengembangan TEXT NOT NULL,
  tanggal_pelaksanaan TEXT NOT NULL,
  link_materi TEXT,
  link_dokumentasi TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX IF NOT EXISTS idx_materi_ppms_nomor ON materi_ppms(nomor_surat);
CREATE INDEX IF NOT EXISTS idx_materi_ppms_tanggal ON materi_ppms(tanggal_pelaksanaan);
