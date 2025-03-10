import fs from "fs";
import path from "path";
import { ComponentResourceOptions, Output, all } from "@pulumi/pulumi";
import { Function } from "./function.js";
import {
  SsrSiteArgs,
  createDevResources,
  createResources,
  prepare,
  validatePlan,
} from "./ssr-site-new.js";
import { Cdn } from "./cdn.js";
import { Bucket } from "./bucket.js";
import { Component } from "../component.js";
import { Link } from "../link.js";
import { buildApp } from "../base/base-ssr-site.js";
import { VisibleError } from "../error.js";

export interface TanstackStartArgs extends SsrSiteArgs {
  /**
   * Configure how this component works in `sst dev`.
   *
   * :::note
   * In `sst dev` your TanstackStart app is run in dev mode; it's not deployed.
   * :::
   *
   * Instead of deploying your TanstackStart app, this starts it in dev mode. It's run
   * as a separate process in the `sst dev` multiplexer. Read more about
   * [`sst dev`](/docs/reference/cli/#dev).
   *
   * To disable dev mode, pass in `false`.
   */
  dev?: SsrSiteArgs["dev"];
  /**
   * Permissions and the resources that the [server function](#nodes-server) in your TanstackStart app needs to access. These permissions are used to create the function's IAM role.
   *
   * :::tip
   * If you `link` the function to a resource, the permissions to access it are
   * automatically added.
   * :::
   *
   * @example
   * Allow reading and writing to an S3 bucket called `my-bucket`.
   * ```js
   * {
   *   permissions: [
   *     {
   *       actions: ["s3:GetObject", "s3:PutObject"],
   *       resources: ["arn:aws:s3:::my-bucket/*"]
   *     },
   *   ]
   * }
   * ```
   *
   * Perform all actions on an S3 bucket called `my-bucket`.
   *
   * ```js
   * {
   *   permissions: [
   *     {
   *       actions: ["s3:*"],
   *       resources: ["arn:aws:s3:::my-bucket/*"]
   *     },
   *   ]
   * }
   * ```
   *
   * Grant permissions to access all resources.
   *
   * ```js
   * {
   *   permissions: [
   *     {
   *       actions: ["*"],
   *       resources: ["*"]
   *     },
   *   ]
   * }
   * ```
   */
  permissions?: SsrSiteArgs["permissions"];
  /**
   * The regions that the [server function](#nodes-server) in your TanstackStart app will be deployed to. Requests will be routed to the nearest region based on the user's location.
   *
   * @default The default region of the SST app
   * @example
   * ```js
   * {
   *   regions: ["us-east-1", "eu-west-1"]
   * }
   * ```
   */
  regions?: SsrSiteArgs["regions"];
  /**
   * Path to the directory where your TanstackStart app is located.  This path is relative to your `sst.config.ts`.
   *
   * By default it assumes your TanstackStart app is in the root of your SST app.
   * @default `"."`
   *
   * @example
   *
   * If your TanstackStart app is in a package in your monorepo.
   *
   * ```js
   * {
   *   path: "packages/web"
   * }
   * ```
   */
  path?: SsrSiteArgs["path"];
  /**
   * [Link resources](/docs/linking/) to your TanstackStart app. This will:
   *
   * 1. Grant the permissions needed to access the resources.
   * 2. Allow you to access it in your site using the [SDK](/docs/reference/sdk/).
   *
   * @example
   *
   * Takes a list of resources to link to the function.
   *
   * ```js
   * {
   *   link: [bucket, stripeKey]
   * }
   * ```
   */
  link?: SsrSiteArgs["link"];
  /**
   * Configure how the CloudFront cache invalidations are handled. This is run after your TanstackStart app has been deployed.
   * :::tip
   * You get 1000 free invalidations per month. After that you pay $0.005 per invalidation path. [Read more here](https://aws.amazon.com/cloudfront/pricing/).
   * :::
   * @default `{paths: "all", wait: false}`
   * @example
   * Wait for all paths to be invalidated.
   * ```js
   * {
   *   invalidation: {
   *     paths: "all",
   *     wait: true
   *   }
   * }
   * ```
   */
  invalidation?: SsrSiteArgs["invalidation"];
  /**
   * Set in your TanstackStart app. These are made available:
   *
   * 1. In `vinxi build`, they are loaded into `process.env`.
   * 2. Locally while running `sst dev vinxi dev`.
   *
   * :::tip
   * You can also `link` resources to your TanstackStart app and access them in a type-safe way with the [SDK](/docs/reference/sdk/). We recommend linking since it's more secure.
   * :::
   *
   * @example
   * ```js
   * {
   *   environment: {
   *     API_URL: api.url,
   *     STRIPE_PUBLISHABLE_KEY: "pk_test_123"
   *   }
   * }
   * ```
   */
  environment?: SsrSiteArgs["environment"];
  /**
   * Set a custom domain for your TanstackStart app.
   *
   * Automatically manages domains hosted on AWS Route 53, Cloudflare, and Vercel. For other
   * providers, you'll need to pass in a `cert` that validates domain ownership and add the
   * DNS records.
   *
   * :::tip
   * Built-in support for AWS Route 53, Cloudflare, and Vercel. And manual setup for other
   * providers.
   * :::
   *
   * @example
   *
   * By default this assumes the domain is hosted on Route 53.
   *
   * ```js
   * {
   *   domain: "example.com"
   * }
   * ```
   *
   * For domains hosted on Cloudflare.
   *
   * ```js
   * {
   *   domain: {
   *     name: "example.com",
   *     dns: sst.cloudflare.dns()
   *   }
   * }
   * ```
   *
   * Specify a `www.` version of the custom domain.
   *
   * ```js
   * {
   *   domain: {
   *     name: "domain.com",
   *     redirects: ["www.domain.com"]
   *   }
   * }
   * ```
   */
  domain?: SsrSiteArgs["domain"];
  /**
   * The command used internally to build your TanstackStart app.
   *
   * @default `"npm run build"`
   *
   * @example
   *
   * If you want to use a different build command.
   * ```js
   * {
   *   buildCommand: "yarn build"
   * }
   * ```
   */
  buildCommand?: SsrSiteArgs["buildCommand"];
  /**
   * Configure how the TanstackStart app assets are uploaded to S3.
   *
   * By default, this is set to the following. Read more about these options below.
   * ```js
   * {
   *   assets: {
   *     textEncoding: "utf-8",
   *     versionedFilesCacheHeader: "public,max-age=31536000,immutable",
   *     nonVersionedFilesCacheHeader: "public,max-age=0,s-maxage=86400,stale-while-revalidate=8640"
   *   }
   * }
   * ```
   */
  assets?: SsrSiteArgs["assets"];
  /**
   * Configure the [server function](#nodes-server) in your TanstackStart app to connect
   * to private subnets in a virtual private cloud or VPC. This allows your app to
   * access private resources.
   *
   * @example
   * ```js
   * {
   *   vpc: {
   *     securityGroups: ["sg-0399348378a4c256c"],
   *     subnets: ["subnet-0b6a2b73896dc8c4c", "subnet-021389ebee680c2f0"]
   *   }
   * }
   * ```
   */
  vpc?: SsrSiteArgs["vpc"];
  /**
   * Configure the TanstackStart app to use an existing CloudFront cache policy.
   *
   * :::note
   * CloudFront has a limit of 20 cache policies per account, though you can request a limit
   * increase.
   * :::
   *
   * By default, a new cache policy is created for it. This allows you to reuse an existing
   * policy instead of creating a new one.
   *
   * @default A new cache policy is created
   * @example
   * ```js
   * {
   *   cachePolicy: "658327ea-f89d-4fab-a63d-7e88639e58f6"
   * }
   * ```
   */
  cachePolicy?: SsrSiteArgs["cachePolicy"];
}

/**
 * The `TanstackStart` component lets you deploy a [TanstackStart](https://tanstack.com/start/latest) app to AWS.
 *
 * @example
 *
 * #### Minimal example
 *
 * Deploy a TanstackStart app that's in the project root.
 *
 * ```js title="sst.config.ts"
 * new sst.aws.TanstackStart("MyWeb");
 * ```
 *
 * #### Change the path
 *
 * Deploys the TanstackStart app in the `my-app/` directory.
 *
 * ```js {2} title="sst.config.ts"
 * new sst.aws.TanstackStart("MyWeb", {
 *   path: "my-app/"
 * });
 * ```
 *
 * #### Add a custom domain
 *
 * Set a custom domain for your TanstackStart app.
 *
 * ```js {2} title="sst.config.ts"
 * new sst.aws.TanstackStart("MyWeb", {
 *   domain: "my-app.com"
 * });
 * ```
 *
 * #### Redirect www to apex domain
 *
 * Redirect `www.my-app.com` to `my-app.com`.
 *
 * ```js {4} title="sst.config.ts"
 * new sst.aws.TanstackStart("MyWeb", {
 *   domain: {
 *     name: "my-app.com",
 *     redirects: ["www.my-app.com"]
 *   }
 * });
 * ```
 *
 * #### Link resources
 *
 * [Link resources](/docs/linking/) to your TanstackStart app. This will grant permissions
 * to the resources and allow you to access it in your app.
 *
 * ```ts {4} title="sst.config.ts"
 * const bucket = new sst.aws.Bucket("MyBucket");
 *
 * new sst.aws.TanstackStart("MyWeb", {
 *   link: [bucket]
 * });
 * ```
 *
 * You can use the [SDK](/docs/reference/sdk/) to access the linked resources
 * in your TanstackStart app.
 *
 * ```ts title="src/app.tsx"
 * import { Resource } from "sst";
 *
 * console.log(Resource.MyBucket.name);
 * ```
 */
export class TanstackStart extends Component implements Link.Linkable {
  private cdn?: Output<Cdn>;
  private assets?: Bucket;
  private server?: Output<Function>;
  private devUrl?: Output<string>;

  constructor(
    name: string,
    args: TanstackStartArgs = {},
    opts: ComponentResourceOptions = {},
  ) {
    super(__pulumiType, name, args, opts);

    const parent = this;
    const { dev, sitePath, regions } = prepare(parent, args);

    if (dev.enabled) {
      const { server } = createDevResources(parent, name, args);
      this.devUrl = dev.url;
      this.registerOutputs({
        _metadata: {
          mode: "placeholder",
          path: sitePath,
          server: server.arn,
        },
        _dev: {
          ...dev.outputs,
          aws: { role: server.nodes.role.arn },
        },
      });
      return;
    }

    const outputPath = buildApp(parent, name, args, sitePath);
    const plan = buildPlan();
    const { distribution, bucket, servers } = createResources(
      parent,
      name,
      args,
      outputPath,
      plan,
      regions,
    );
    const server = servers.apply((servers) => servers[0]);

    this.assets = bucket;
    this.cdn = distribution;
    this.server = server;
    this.registerOutputs({
      _hint: all([this.cdn.domainUrl, this.cdn.url]).apply(
        ([domainUrl, url]) => domainUrl ?? url,
      ),
      _metadata: {
        mode: "deployed",
        path: sitePath,
        url: distribution.apply((d) => d.domainUrl ?? d.url),
        server: server.arn,
      },
      _dev: {
        ...dev.outputs,
        aws: { role: server.nodes.role.arn },
      },
    });

    function buildPlan() {
      return outputPath.apply((outputPath) => {
        const nitro = JSON.parse(
          fs
            .readFileSync(path.join(outputPath, ".output/nitro.json"))
            .toString(),
        );
        if (!["aws-lambda"].includes(nitro.preset)) {
          throw new VisibleError(
            `TanstackStart's app.config.ts must be configured to use the "aws-lambda" preset. It is currently set to "${nitro.preset}".`,
          );
        }

        return validatePlan({
          server: {
            description: "Server handler for Tanstack",
            handler: "index.handler",
            bundle: path.join(outputPath, ".output", "server"),
            streaming: nitro?.config?.awsLambda?.streaming === true,
          },
          s3: {
            copy: [
              {
                from: path.join(".output", "public"),
                to: "",
                cached: true,
              },
            ],
          },
        });
      });
    }
  }

  /**
   * The URL of the TanstackStart app.
   *
   * If the `domain` is set, this is the URL with the custom domain.
   * Otherwise, it's the autogenerated CloudFront URL.
   */
  public get url() {
    return all([this.cdn?.domainUrl, this.cdn?.url, this.devUrl]).apply(
      ([domainUrl, url, dev]) => domainUrl ?? url ?? dev!,
    );
  }

  /**
   * The underlying [resources](/docs/components/#nodes) this component creates.
   */
  public get nodes() {
    return {
      /**
       * The AWS Lambda server function that renders the site.
       */
      server: this.server,
      /**
       * The Amazon S3 Bucket that stores the assets.
       */
      assets: this.assets,
      /**
       * The Amazon CloudFront CDN that serves the site.
       */
      cdn: this.cdn,
    };
  }

  /** @internal */
  public getSSTLink() {
    return {
      properties: {
        url: this.url,
      },
    };
  }
}

const __pulumiType = "sst:aws:TanstackStart";
// @ts-expect-error
TanstackStart.__pulumiType = __pulumiType;
