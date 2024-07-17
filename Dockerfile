###################
# BUILD FOR LOCAL DEVELOPMENT
###################

FROM node:18-alpine As build

# Create app directory
WORKDIR /usr/src/app

# Copying required files for installing dependencies
COPY --chown=node:node package.json .yarnrc.yml yarn.lock ./
COPY --chown=node:node .yarn ./.yarn
COPY --chown=node:node packages/graph/package.json ./packages/graph/

RUN yarn set version 3.5.1

# Install app dependencies without modifiying lock file
# --immutable will fail because only the root package.json and the server package.json is copied
RUN yarn install

# Copy the app development code
COPY --chown=node:node packages/graph ./packages/graph

# Set for production
ENV NODE_ENV production

# Run the build command which creates the production bundle
RUN yarn workspace graph build

# Use the node user from the image (instead of the root user)
USER node

# ###################
# # PRODUCTION
# ###################

FROM node:18-alpine As production

WORKDIR /usr/src/app

# Copying required files for installing dependencies. The CI has an issue with copying the nested node_modules directory from the build step
COPY --chown=node:node package.json .yarnrc.yml yarn.lock ./
COPY --chown=node:node .yarn ./.yarn
COPY --chown=node:node packages/graph/package.json ./packages/graph/

# Copy production code from the build
COPY --chown=node:node --from=build /usr/src/app/packages/graph/dist ./packages/graph/dist
COPY --chown=node:node packages/graph/src/schema.gql ./packages/graph/dist/

RUN yarn set version 3.5.1
# required for the focus command
RUN yarn plugin import workspace-tools

ENV NODE_ENV production
# Install production dependencies only and clean cache for smaller package
RUN yarn workspaces focus --all --production && yarn cache clean

USER node
EXPOSE 8081

# Start the server using the production build
CMD [ "node", "packages/graph/dist/main.js" ]