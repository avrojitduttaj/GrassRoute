This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05)

# GrassRoute: Using AI to Spend Less Time on Your Phone

## What I Built

I wanted to build something that uses technology to get people away from technology.

Most of us spend a lot of time on our phones, even when we have some free time. Sometimes we want to go outside but end up scrolling because we do not know where to go or what to do.

That was the idea behind GrassRoute.

GrassRoute is an outdoor exploration app that helps people discover nearby green spaces, plan walking routes, and generate small missions based on the time they have.

You can choose between 15, 30, 45, and 60 minutes, select an exploration radius, and look for nearby outdoor places. The app can then help you plan a walk and generate a mission to make it a little more interesting.

The goal is not to keep people using another app for hours. It is to help them find something to do outside, get the information they need, and put their phones away.

## Demo

**Live website:** [https://grassroute-web1.onrender.com/](https://grassroute-web1.onrender.com/)

The frontend and backend are deployed on Render, so you can try the application online.

## Code

**GitHub repository:** [https://github.com/avrojitduttaj/GrassRoute](https://github.com/avrojitduttaj/GrassRoute)

The repository contains the source code and setup instructions for running the project locally.

## How I Built It

I built GrassRoute using React, Vite, TypeScript, Express, and Python.

Here is how the main parts fit together:

- **Frontend:** React, Vite, TypeScript, Leaflet, and React-Leaflet power the interface and interactive map.
- **Backend:** Express and TypeScript handle API requests, validate inputs, and connect the different services.
- **AI:** I used Gemma 3 4B for the mission-generation feature. During local development, it can run through Ollama, with a Python FastAPI service handling requests. The deployed backend is configured to use Gemma through OpenRouter.
- **Place discovery:** OpenStreetMap data and public Overpass API instances help find mapped parks, gardens, nature reserves, and other green spaces.
- **Walking routes:** A Valhalla routing service provides walking route geometry, estimated distance, duration, and available directions.
- **Deployment:** The frontend is deployed as a Render Static Site, while the backend runs as a separate Render Web Service.

One thing I wanted to account for was the possibility of the AI service failing. The app includes a fallback mission generator so that it can still return a basic mission when AI generation is unavailable.

Getting everything to work together took more effort than I initially expected. I had to fix TypeScript errors, deal with API integration problems, configure the deployment settings, and troubleshoot timeouts from public map-data services. There were several moments when something worked locally but needed more debugging after deployment.

Eventually, I got both services running online.

## Why Does Open Innovation Matter?

I chose an open-weight model because I wanted to experiment with the AI instead of depending entirely on a closed model API.

With Gemma, I can change the prompts, experiment with different approaches to generating missions, and explore running the model locally through Ollama. This gives me more control over the AI component and makes local experimentation possible without depending on a hosted model endpoint.

For deployment, I chose a hosted inference option because running a model server continuously was not practical for my current setup.

There is an important distinction here: GrassRoute is not a completely offline application. The map, place discovery, and walking routes depend on internet services, and the deployed AI setup also uses a hosted endpoint.

Still, using an open-weight model gives me the flexibility to experiment locally and explore different ways of serving the model as the project develops.

I also wanted the application to remain useful when AI generation fails. A simple fallback mission is better than leaving the user with nothing because an external service is unavailable.

For me, open innovation is valuable because it gives developers room to understand, modify, and experiment with the technology they build on. It makes it easier to start small and improve a project without locking every part of it to one provider.

## My Agent Session

I created a curated agent session for GrassRoute that summarizes the project and its development and deployment approach. The original IDE transcript was unavailable, so this is a curated build summary rather than a complete recording of the original development process.

{% agent_session grassroute-building-and-deploying-an-open-source-ai-outdoor-companion-rsrd1s %}

You can also [view the GrassRoute Agent Session directly](https://dev.to/agent_sessions/grassroute-building-and-deploying-an-open-source-ai-outdoor-companion-rsrd1s).

## Prize Categories

**Best Use of Gemma**

GrassRoute uses Gemma 3 4B for its outdoor mission-generation feature, with local experimentation through Ollama and a hosted inference setup for deployment.

**Best Use of Render**

I deployed the frontend and backend as separate Render services, making the project available online without having to maintain my own server infrastructure.

## What's Next?

GrassRoute is still an early-stage project, and there is a lot I would like to improve.

I want to make place discovery more reliable, improve mission personalization, and test the app during actual walks to see how useful the missions are in practice.

There are also limitations to account for. OpenStreetMap data may be incomplete, public services can experience downtime, and a mapped location or calculated route does not guarantee that a place is accessible, open, or safe.

I would like to keep improving the project based on how it performs outside a development environment.

Building GrassRoute for the Touch Grass theme gave me an opportunity to explore a different use of AI. Instead of using it to generate more content for someone to consume on a screen, I wanted to use it to help someone decide what to do after putting the screen away.

That is what I hope GrassRoute can do.

#devchallenge #hf26challenge
