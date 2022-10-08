### INSTALL
```
sudo docker run --name sellbuy-postgres-prod --restart=always -e POSTGRES_PASSWORD=sellbuy -e POSTGRES_USER=sellbuy -e POSTGRES_DB=sellbuy -d -p 5442:5432 -v /home/fanil/database/sellbuy-prod:/var/lib/postgresql/data postgres
```