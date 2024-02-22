#!/usr/bin/with-contenv bashio

CONFIG=$(bashio::addon.options)

# === Migrate 1.2.0 config ===

consumption_prm=$(echo "$CONFIG" | jq -r '."consumption PRM" // empty')
if [ ! -z "$consumption_prm" ]; then
    bashio::addon.option 'meters[0].prm' "$consumption_prm"
    echo -e "\e[33mMoved consumption PRM to meters configuration\e[0m"
fi

consumption_token=$(echo "$CONFIG" | jq -r '."consumption token" // empty')
if [ ! -z "$consumption_token" ]; then
    bashio::addon.option 'meters[0].token' "$consumption_token"
    echo -e "\e[33mMoved consumption token to meters configuration\e[0m"
fi

consumption_name=$(echo "$CONFIG" | jq -r '."consumption name" // empty')
if [ ! -z "$consumption_name" ]; then
    bashio::addon.option 'meters[0].name' "$consumption_name"
    echo -e "\e[33mMoved consumption name to meters configuration\e[0m"
fi

consumption_action=$(echo "$CONFIG" | jq -r '."consumption action" // empty')
if [ ! -z "$consumption_action" ]; then
    bashio::addon.option 'meters[0].action' "$consumption_action"
    echo -e "\e[33mMoved consumption action to meters configuration\e[0m"
fi

production_prm=$(echo "$CONFIG" | jq -r '."production PRM" // empty')
if [ ! -z "$production_prm" ]; then
    bashio::addon.option 'meters[1].prm' "$production_prm"
    echo -e "\e[33mMoved production PRM to meters configuration\e[0m"
fi

production_token=$(echo "$CONFIG" | jq -r '."production token" // empty')
if [ ! -z "$production_token" ]; then
    bashio::addon.option 'meters[1].token' "$production_token"
    echo -e "\e[33mMoved production token to meters configuration\e[0m"
fi

production_name=$(echo "$CONFIG" | jq -r '."production name" // empty')
if [ ! -z "$production_name" ]; then
    bashio::addon.option 'meters[1].name' "$production_name"
    echo -e "\e[33mMoved production name to meters configuration\e[0m"
fi

production_action=$(echo "$CONFIG" | jq -r '."production action" // empty')
if [ ! -z "$production_action" ]; then
    bashio::addon.option 'meters[1].action' "$production_action"
    echo -e "\e[33mMoved production action to meters configuration\e[0m"
fi

if [ ! -z "$consumption_prm" ] || [ ! -z "$consumption_token" ] || [ ! -z "$consumption_name" ] || [ ! -z "$consumption_action" ] || [ ! -z "$production_prm" ] || [ ! -z "$production_token" ] || [ ! -z "$production_name" ]  || [ ! -z "$production_action" ]; then
    bashio::addon.option '"consumption PRM"'
    bashio::addon.option '"consumption token"'
    bashio::addon.option '"consumption name"'
    bashio::addon.option '"consumption action"'
    bashio::addon.option '"production PRM"'
    bashio::addon.option '"production token"'
    bashio::addon.option '"production name"'
    bashio::addon.option '"production action"'
    echo -e "\e[33mRestarting add-on\e[0m"
    bashio::addon.restart
fi

# Run HA Linky
node --experimental-modules dist/index.js
