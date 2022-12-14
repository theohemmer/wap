FROM node:16

WORKDIR /usr/src/app

VOLUME [ "/usr/src/app/pldGenerator/custom/customGenerator", "/usr/src/app/pldGenerator/generated", "/usr/src/app/pldGenerator/assets" ]

COPY ./package*.json ./

RUN npm install

COPY ./ ./

WORKDIR /usr/src/app/pldGenerator

RUN npm install

WORKDIR /usr/src/app

RUN npm run buildMail

RUN npm run build

EXPOSE 4000

RUN chmod +x dockerEntrypoint.sh
ENTRYPOINT [ "/usr/src/app/dockerEntrypoint.sh" ]
CMD ["npm", "start"]
