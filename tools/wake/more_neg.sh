cd /tmp/claude-0/wake
get() { # name url
  curl -sSL -m 1800 -o data/$1.parquet "$2" && python3 -I gen_fleurs.py $1 && rm -f data/$1.parquet
}
for c in ar_eg en_us hi_in ur_pk fa_ir de_de pt_br id_id tr_tr fr_fr es_419 it_it ru_ru sw_ke; do
  get fl_${c}_train "https://huggingface.co/api/datasets/google/fleurs/parquet/$c/train/0.parquet"
done
for i in 0 1 2 3; do
  get ls_other_$i "https://huggingface.co/api/datasets/openslr/librispeech_asr/parquet/other/train.500/$i.parquet"
done
echo NEGDONE
