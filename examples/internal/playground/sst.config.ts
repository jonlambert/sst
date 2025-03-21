/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "playground",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
    };
  },
  async run() {
    const ret: Record<string, $util.Output<string>> = {};

    const vpc = addVpc();
    const bucket = addBucket();
    const auth = addAuth();
    const oc = addOpenControl();
    addSsrSite();
    addStaticSite();
    //const queue = addQueue();
    //const efs = addEfs();
    //const email = addEmail();
    //const apiv1 = addApiV1();
    //const apiv2 = addApiV2();
    //const apiws = addApiWebsocket();
    const router = addRouter();
    //const app = addFunction();
    //const cluster = addCluster();
    //const service = addService();
    //const task = addTask();
    //const postgres = addAuroraPostgres();
    //const postgres = addPostgres();
    //const redis = addRedis();
    //const cron = addCron();
    //const topic = addTopic();
    //const bus = addBus();

    return ret;

    function addVpc() {
      const vpc = new sst.aws.Vpc("MyVpc");
      return vpc;
    }

    function addBucket() {
      const bucket = new sst.aws.Bucket("MyBucket", {
        access: "public",
      });

      //const queue = new sst.aws.Queue("MyQueue");
      //queue.subscribe("functions/bucket/index.handler");

      //const topic = new sst.aws.SnsTopic("MyTopic");
      //topic.subscribe("MyTopicSubscriber", "functions/bucket/index.handler");

      //bucket.notify({
      //  notifications: [
      //    {
      //      name: "LambdaSubscriber",
      //      function: "functions/bucket/index.handler",
      //      filterSuffix: ".json",
      //      events: ["s3:ObjectCreated:*"],
      //    },
      //    {
      //      name: "QueueSubscriber",
      //      queue,
      //      filterSuffix: ".png",
      //      events: ["s3:ObjectCreated:*"],
      //    },
      //    {
      //      name: "TopicSubscriber",
      //      topic,
      //      filterSuffix: ".csv",
      //      events: ["s3:ObjectCreated:*"],
      //    },
      //  ],
      //});
      ret.bucket = bucket.name;
      return bucket;
    }

    function addAuth() {
      const auth = new sst.aws.Auth("MyAuth", {
        authorizer: "functions/auth/index.handler",
      });
      return auth;
    }

    function addOpenControl() {
      const oc = new sst.aws.OpenControl("MyOpenControl", {
        server: {
          handler: "functions/open-control/index.handler",
          link: [bucket],
          policies: ["arn:aws:iam::aws:policy/ReadOnlyAccess"],
        },
      });
      return oc;
    }

    function addQueue() {
      const queue = new sst.aws.Queue("MyQueue");
      queue.subscribe("functions/queue/index.subscriber");

      new sst.aws.Function("MyQueuePublisher", {
        handler: "functions/queue/index.publisher",
        link: [queue],
        url: true,
      });
      ret.queue = queue.url;

      return queue;
    }

    function addEfs() {
      const efs = new sst.aws.Efs("MyEfs", { vpc });
      ret.efs = efs.id;
      ret.efsAccessPoint = efs.nodes.accessPoint.id;

      const app = new sst.aws.Function("MyEfsApp", {
        handler: "functions/efs/index.handler",
        volume: { efs },
        url: true,
        vpc,
      });
      ret.efsApp = app.url;

      return efs;
    }

    function addEmail() {
      const topic = new sst.aws.SnsTopic("MyTopic");
      topic.subscribe(
        "MyTopicSubscriber",
        "functions/email/index.notification"
      );

      const email = new sst.aws.Email("MyEmail", {
        sender: "wangfanjie@gmail.com",
        events: [
          {
            name: "notif",
            types: ["delivery"],
            topic: topic.arn,
          },
        ],
      });

      const sender = new sst.aws.Function("MyApi", {
        handler: "functions/email/index.sender",
        link: [email],
        url: true,
      });

      ret.emailSend = sender.url;
      ret.email = email.sender;
      ret.emailConfig = email.configSet;
      return ret;
    }

    function addApiV1() {
      const api = new sst.aws.ApiGatewayV1("MyApiV1");
      api.route("GET /", {
        handler: "functions/apiv2/index.handler",
        link: [bucket],
      });
      api.deploy();
      return api;
    }

    function addApiV2() {
      const api = new sst.aws.ApiGatewayV2("MyApiV2", {
        link: [bucket],
      });
      const authorizer = api.addAuthorizer({
        name: "MyAuthorizer",
        lambda: {
          function: "functions/apiv2/index.authorizer",
          identitySources: [],
        },
      });
      api.route(
        "GET /",
        {
          handler: "functions/apiv2/index.handler",
        },
        {
          auth: { lambda: authorizer.id },
        }
      );
      return api;
    }

    function addApiWebsocket() {
      const api = new sst.aws.ApiGatewayWebSocket("MyApiWebsocket", {});
      const authorizer = api.addAuthorizer("MyAuthorizer", {
        lambda: {
          function: "functions/apiws/index.authorizer",
          identitySources: ["route.request.querystring.Authorization"],
        },
      });
      api.route("$connect", "functions/apiws/index.connect", {
        auth: { lambda: authorizer.id },
      });
      api.route("$disconnect", "functions/apiws/index.disconnect");
      api.route("$default", {
        handler: "functions/apiws/index.catchAll",
        link: [api],
      });
      api.route("sendmessage", "functions/apiws/index.sendMessage");

      return {
        managementEndpoint: api.managementEndpoint,
      };
      return api;
    }

    function addRouter() {
      const app = new sst.aws.Function("MyRouterApp", {
        handler: "functions/router/index.handler",
        url: true,
      });
      const rr7 = new sst.aws.React("MyRouterSite", {
        path: "sites/react-router-7-ssr",
        cdn: false,
      });
      const astro5 = new sst.aws.Astro("MyRouterAstroSite", {
        path: "sites/astro5",
        cdn: false,
      });
      const solid = new sst.aws.SolidStart("MyRouterSolidSite", {
        path: "sites/solid-start",
        link: [bucket],
        cdn: false,
      });
      const nuxt = new sst.aws.Nuxt("MyRouterNuxtSite", {
        path: "sites/nuxt",
        link: [bucket],
        cdn: false,
      });
      const tanstackStart = new sst.aws.TanStackStart(
        "MyRouterTanStackStartSite",
        {
          path: "sites/tanstack-start",
          cdn: false,
        }
      );
      const svelte = new sst.aws.SvelteKit("MyRouterSvelteSite", {
        path: "sites/svelte-kit",
        link: [bucket],
        cdn: false,
      });
      const analog = new sst.aws.Analog("MyRouterAnalogSite", {
        path: "sites/analog",
        link: [bucket],
        cdn: false,
      });
      const remix = new sst.aws.Remix("MyRouterRemixSite", {
        path: "sites/remix",
        link: [bucket],
        cdn: false,
      });
      const nextjs = new sst.aws.Nextjs("MyRouterNextSite", {
        path: "sites/nextjs",
        link: [bucket],
        cdn: false,
      });
      const vite = new sst.aws.StaticSite("Web", {
        path: "sites/vite",
        build: {
          command: "npm run build",
          output: "dist",
        },
        base: "/vite",
        cdn: false,
      });

      const router = new sst.aws.Router("MyRouter", {
        domain: {
          name: "router.playground.sst.sh",
          aliases: ["*.router.playground.sst.sh"],
        },
      });
      router.route("api.router.playground.sst.sh/", app.url);
      router.route("/api", app.url, {
        rewrite: {
          regex: "^/api/(.*)$",
          to: "/$1",
        },
      });
      router.routeSite("/rr7", rr7);
      router.routeSite("/astro5", astro5);
      router.routeSite("/solid", solid);
      router.routeSite("/nuxt", nuxt);
      router.routeSite("/svelte", svelte);
      //router.routeSite("/tan", tanstackStart);
      router.routeSite("/analog", analog);
      router.routeSite("/remix", remix);
      router.routeSite("/vite", vite);
      router.routeSite("/next", nextjs);

      return router;
    }

    function addFunction() {
      const app = new sst.aws.Function("MyApp", {
        handler: "functions/handler-example/index.handler",
        link: [bucket],
        url: true,
      });
      ret.app = app.url;
      return app;
    }

    function addCluster() {
      return new sst.aws.Cluster("MyCluster", { vpc });
    }

    function addService() {
      return new sst.aws.Service("MyService", {
        cluster,
        loadBalancer: {
          ports: [
            { listen: "80/http" },
            //{ listen: "80/http", container: "web" },
            //{ listen: "8080/http", container: "sidecar" },
          ],
        },
        image: {
          context: "images/web",
        },
        //containers: [
        //  {
        //    name: "web",
        //    image: {
        //      context: "images/web",
        //    },
        //    cpu: "0.125 vCPU",
        //    memory: "0.25 GB",
        //  },
        //  {
        //    name: "sidecar",
        //    image: {
        //      context: "images/sidecar",
        //    },
        //    cpu: "0.125 vCPU",
        //    memory: "0.25 GB",
        //  },
        //],
        link: [bucket],
      });
    }

    function addTask() {
      const task = new sst.aws.Task("MyTask", {
        cluster,
        image: {
          context: "images/task",
        },
        link: [bucket],
      });

      new sst.aws.Function("MyTaskApp", {
        handler: "functions/task/index.handler",
        url: true,
        vpc,
        link: [task],
      });

      //new sst.aws.Cron("MyTaskCron", {
      //  schedule: "rate(1 minute)",
      //  task,
      //});

      return task;
    }

    function addAuroraPostgres() {
      const postgres = new sst.aws.Aurora("MyPostgres", {
        engine: "postgres",
        vpc,
      });
      new sst.aws.Function("MyPostgresApp", {
        handler: "functions/postgres/index.handler",
        url: true,
        link: [postgres],
        vpc,
      });
      ret.pgHost = postgres.host;
      ret.pgPort = $interpolate`${postgres.port}`;
      ret.pgUsername = postgres.username;
      ret.pgPassword = postgres.password;
      ret.pgDatabase = postgres.database;
      return postgres;
    }

    function addPostgres() {
      const postgres = new sst.aws.Postgres("MyPostgres", {
        vpc,
      });
      new sst.aws.Function("MyPostgresApp", {
        handler: "functions/postgres/index.handler",
        url: true,
        vpc,
        link: [postgres],
      });
      ret.pgHost = postgres.host;
      ret.pgPort = $interpolate`${postgres.port}`;
      ret.pgUsername = postgres.username;
      ret.pgPassword = postgres.password;
      return postgres;
    }

    function addRedis() {
      const redis = new sst.aws.Redis("MyRedis", { vpc });
      const app = new sst.aws.Function("MyRedisApp", {
        handler: "functions/redis/index.handler",
        url: true,
        vpc,
        link: [redis],
      });
      return redis;
    }

    function addCron() {
      const cron = new sst.aws.Cron("MyCron", {
        schedule: "rate(1 minute)",
        function: {
          handler: "functions/cron/index.handler",
          link: [bucket],
        },
        event: { foo: "bar" },
      });
      ret.cron = cron.nodes.function.name;
      return cron;
    }

    function addTopic() {
      const topic = new sst.aws.SnsTopic("MyTopic");
      topic.subscribe("MyTopicSubscriber", "functions/topic/index.subscriber");

      new sst.aws.Function("MyTopicPublisher", {
        handler: "functions/topic/index.publisher",
        link: [topic],
        url: true,
      });

      return topic;
    }

    function addBus() {
      const bus = new sst.aws.Bus("MyBus");
      bus.subscribe("functions/bus/index.subscriber", {
        pattern: {
          source: ["app.myevent"],
        },
      });
      bus.subscribeQueue("test", queue);

      new sst.aws.Function("MyBusPublisher", {
        handler: "functions/bus/index.publisher",
        link: [bus],
        url: true,
      });

      return bus;
    }

    function addSsrSite() {
      new sst.aws.Astro("MyNextjsSite", {
        //domain: "ssr.playground.sst.sh",
        //path: "sites/nextjs",
        //path: "sites/astro4",
        //path: "sites/astro5",
        path: "sites/astro5-static",
        //path: "sites/react-router-7-ssr",
        //path: "sites/react-router-7-csr",
        //path: "sites/tanstack-start",

        // multi-region
        //regions: ["us-east-1", "us-west-1"],
        link: [bucket],
        //assets: {
        //  purge: true,
        //},
      });
    }

    function addStaticSite() {
      new sst.aws.StaticSite("MyStaticSite", {
        path: "sites/vite",
        build: {
          command: "npm run build",
          output: "dist",
        },
        errorPage: "index.html",
      });
    }
  },
});
