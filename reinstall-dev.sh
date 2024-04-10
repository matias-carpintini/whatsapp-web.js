#!/bin/sh
echo 'Removing cache and auth files...';
rm -rf *.zip; 
mkdir .wwebjs_cache; 
rm -rf .wwebjs_cache/*; 
chmod 777 .wwebjs_cache; 
if [[ $1 -eq "1" ]]; then
    echo 'Reinstalling modules';
    rm -rf node_modules; npm i;
else
    echo 'Skipping modules';
fi